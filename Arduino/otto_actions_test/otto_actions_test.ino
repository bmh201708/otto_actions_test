#include "ottoactions.h"
#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <WiFi.h>
#include <driver/i2s.h>

// ================= 引脚与网络配置 =================
const int PIN_TRIG = 32;
const int PIN_ECHO = 33;

#define MIC_WS 21
#define MIC_SD 35
#define MIC_SCK 19
#define AMP_LRC 22
#define AMP_DIN 15
#define AMP_BCLK 2

#define I2S_MIC_PORT I2S_NUM_0
#define I2S_AMP_PORT I2S_NUM_1

const int VOICE_SAMPLE_RATE = 8000;
const int VOICE_MAX_SECONDS = 2;
const size_t VOICE_MAX_PCM_BYTES =
    VOICE_SAMPLE_RATE * sizeof(int16_t) * VOICE_MAX_SECONDS;

const char *wifi_name = "jim";
const char *wifi_password = "jyk201708";
const char *baiduAK = "rNrzpMFagAtyTudGiq58M3NH";
const char *baiduSK = "BGO8ABwxIm2k3lNYISWw445o3hhXwx15";
const char *deviceToken = "otto-local-token";

const unsigned long REMOTE_CONTROL_COOLDOWN_MS = 30000;
const unsigned long PROXIMITY_GREETING_COOLDOWN_MS = 12000;
const float PROXIMITY_GREETING_MIN_CM = 4.0f;
const float PROXIMITY_GREETING_MAX_CM = 25.0f;
const int COMMAND_QUEUE_CAPACITY = 8;

String baiduAccessToken = "";
bool isBusy = false;

WebServer server(80);
SemaphoreHandle_t commandMutex = nullptr;
SemaphoreHandle_t stateMutex = nullptr;

volatile bool isSpeaking = false;
String speechQueue = "";
unsigned long lastRemoteCommandAt = 0;
unsigned long lastTelemetryRefreshAt = 0;
unsigned long commandCounter = 0;
unsigned long lastProximityGreetingAt = 0;
bool proximityGreetingLatched = false;

struct DeviceState {
  bool isOnline;
  bool isBusy;
  String currentAction;
  float distanceCm;
  String signalStrength;
  unsigned long lastTelemetryAtMs;
  String firmwareVersion;
  int memoryPercent;
  int batteryPercent;
  int coreTempC;
  String lastError;
  bool isListening;
  String audioUploadState;
  String lastTranscriptPreview;
  String activeVoiceSessionId;
};

struct CommandItem {
  bool used;
  String id;
  String kind;
  String payload;
};

DeviceState deviceState = {true, false,     "idle", 0.0f, "Unknown",
                           0,    "V.4.2.8", 12,     84,   42,
                           "",   false,     "idle", "",   ""};
CommandItem commandQueue[COMMAND_QUEUE_CAPACITY];
int commandHead = 0;
int commandTail = 0;
int commandCount = 0;

uint8_t voicePcmBuffer[VOICE_MAX_PCM_BYTES];
size_t voiceBytesCaptured = 0;
unsigned long voiceCaptureStartedAt = 0;
bool pendingVoiceUpload = false;
String pendingVoiceUploadUrl = "";

// ================= 语音引擎 =================
void speakBlocking(String text) {
  if (text == "")
    return;

  HTTPClient httpTTS;
  httpTTS.begin("http://tsn.baidu.com/text2audio");
  httpTTS.addHeader("Content-Type", "application/x-www-form-urlencoded");

  String encodedText = "";
  for (char c : text) {
    if (isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') {
      encodedText += c;
    } else {
      char buf[4];
      sprintf(buf, "%%%02X", (unsigned char)c);
      encodedText += buf;
    }
  }

  String payload = "tex=" + encodedText +
                   "&lan=zh&cuid=otto&ctp=1&tok=" + baiduAccessToken +
                   "&per=0&spd=5&vol=15&aue=5";
  int code = httpTTS.POST(payload);
  if (code == 200) {
    int len = httpTTS.getSize();
    WiFiClient *stream = httpTTS.getStreamPtr();
    uint8_t mono[1024];
    int16_t stereo[1024];
    int downloaded = 0;

    while (httpTTS.connected() && downloaded < len) {
      if (stream->available()) {
        int read = stream->readBytes(mono, min(1024, len - downloaded));
        int samples = (read & ~1) / 2;
        int16_t *pcm = reinterpret_cast<int16_t *>(mono);
        for (int i = 0; i < samples; i++) {
          stereo[i * 2] = pcm[i];
          stereo[i * 2 + 1] = pcm[i];
        }
        size_t written;
        i2s_write(I2S_AMP_PORT, stereo, samples * 4, &written, portMAX_DELAY);
        downloaded += read;
      }
    }
  }

  httpTTS.end();
  delay(200);
  i2s_zero_dma_buffer(I2S_AMP_PORT);
}

void ttsTask(void *pvParameters) {
  while (true) {
    if (speechQueue != "") {
      isSpeaking = true;
      speakBlocking(speechQueue);
      speechQueue = "";
      isSpeaking = false;
    }
    vTaskDelay(10 / portTICK_PERIOD_MS);
  }
}

void speakAsync(String text) { speechQueue = text; }

void waitForSpeechCompletion() {
  while (isSpeaking || speechQueue != "") {
    delay(10);
    yield();
  }
}

// ================= 状态与传感器 =================
float readDistanceCm() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  long duration = pulseIn(PIN_ECHO, HIGH, 30000);
  if (duration <= 0)
    return 0.0f;
  return duration * 0.034f / 2.0f;
}

String signalStrengthFromRssi(long rssi) {
  if (rssi >= -60)
    return "Excellent";
  if (rssi >= -70)
    return "Stable";
  if (rssi >= -80)
    return "Weak";
  return "Poor";
}

int memoryPercentFromHeap() {
  uint32_t total = ESP.getHeapSize();
  uint32_t free = ESP.getFreeHeap();
  if (total == 0)
    return 0;
  return constrain((int)(((total - free) * 100.0f) / total), 0, 100);
}

void updateDeviceState(bool busy, const String &currentAction,
                       const String &lastError, float distanceCm,
                       const String &signalStrength, int batteryPercent,
                       int coreTempC, int memoryPercent) {
  xSemaphoreTake(stateMutex, portMAX_DELAY);
  deviceState.isOnline = WiFi.status() == WL_CONNECTED;
  deviceState.isBusy = busy;
  deviceState.currentAction = currentAction;
  if (lastError != "")
    deviceState.lastError = lastError;
  else if (!busy)
    deviceState.lastError = "";
  if (distanceCm >= 0)
    deviceState.distanceCm = distanceCm;
  deviceState.signalStrength = signalStrength;
  deviceState.batteryPercent = batteryPercent;
  deviceState.coreTempC = coreTempC;
  deviceState.memoryPercent = memoryPercent;
  deviceState.lastTelemetryAtMs = millis();
  xSemaphoreGive(stateMutex);
}

void updateVoiceState(bool listening, const String &uploadState,
                      const String &sessionId,
                      const String &transcriptPreview) {
  xSemaphoreTake(stateMutex, portMAX_DELAY);
  deviceState.isListening = listening;
  deviceState.audioUploadState = uploadState;
  deviceState.activeVoiceSessionId = sessionId;
  deviceState.lastTranscriptPreview = transcriptPreview;
  if (listening) {
    deviceState.currentAction = "listening";
  } else if (!deviceState.isBusy && deviceState.currentAction == "listening") {
    deviceState.currentAction = "idle";
  }
  deviceState.lastTelemetryAtMs = millis();
  xSemaphoreGive(stateMutex);
}

void refreshTelemetry(bool sampleDistance) {
  float distance = sampleDistance ? readDistanceCm() : -1.0f;
  long rssi = WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : -100;
  updateDeviceState(isBusy, deviceState.currentAction, "", distance,
                    WiFi.status() == WL_CONNECTED ? signalStrengthFromRssi(rssi)
                                                  : "Offline",
                    84, 42, memoryPercentFromHeap());
}

String buildStatusResponseJson(bool includeEnvelope = true) {
  DynamicJsonDocument doc(1024);
  if (includeEnvelope)
    doc["ok"] = true;

  xSemaphoreTake(stateMutex, portMAX_DELAY);
  JsonObject status =
      includeEnvelope ? doc.createNestedObject("status") : doc.to<JsonObject>();
  status["isOnline"] = deviceState.isOnline;
  status["isBusy"] = deviceState.isBusy;
  status["currentAction"] = deviceState.currentAction;
  status["distanceCm"] = deviceState.distanceCm;
  status["signalStrength"] = deviceState.signalStrength;
  status["lastTelemetryAt"] = deviceState.lastTelemetryAtMs;
  status["firmwareVersion"] = deviceState.firmwareVersion;
  status["memoryPercent"] = deviceState.memoryPercent;
  status["batteryPercent"] = deviceState.batteryPercent;
  status["coreTempC"] = deviceState.coreTempC;
  status["lastError"] = deviceState.lastError;
  status["wifiRssi"] = WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : -100;
  status["isListening"] = deviceState.isListening;
  status["audioUploadState"] = deviceState.audioUploadState;
  status["lastTranscriptPreview"] = deviceState.lastTranscriptPreview;
  status["activeVoiceSessionId"] = deviceState.activeVoiceSessionId;
  xSemaphoreGive(stateMutex);

  String body;
  serializeJson(doc, body);
  return body;
}

// ================= 麦克风录音 =================
void initMicrophone() {
  i2s_config_t mic_cfg = {.mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
                          .sample_rate = VOICE_SAMPLE_RATE,
                          .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
                          .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
                          .communication_format = I2S_COMM_FORMAT_STAND_I2S,
                          .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
                          .dma_buf_count = 8,
                          .dma_buf_len = 256,
                          .use_apll = false,
                          .tx_desc_auto_clear = false};
  i2s_pin_config_t mic_p = {.mck_io_num = I2S_PIN_NO_CHANGE,
                            .bck_io_num = MIC_SCK,
                            .ws_io_num = MIC_WS,
                            .data_out_num = I2S_PIN_NO_CHANGE,
                            .data_in_num = MIC_SD};
  i2s_driver_install(I2S_MIC_PORT, &mic_cfg, 0, NULL);
  i2s_set_pin(I2S_MIC_PORT, &mic_p);
  i2s_zero_dma_buffer(I2S_MIC_PORT);
}

void writeWavHeader(uint8_t *header, size_t pcmBytes) {
  const uint32_t byteRate = VOICE_SAMPLE_RATE * sizeof(int16_t);
  const uint32_t chunkSize = 36 + pcmBytes;
  const uint32_t sampleRate = VOICE_SAMPLE_RATE;
  const uint16_t blockAlign = sizeof(int16_t);
  const uint16_t bitsPerSample = 16;
  memcpy(header, "RIFF", 4);
  memcpy(header + 4, &chunkSize, 4);
  memcpy(header + 8, "WAVEfmt ", 8);
  const uint32_t subChunk1Size = 16;
  const uint16_t audioFormat = 1;
  const uint16_t channels = 1;
  memcpy(header + 16, &subChunk1Size, 4);
  memcpy(header + 20, &audioFormat, 2);
  memcpy(header + 22, &channels, 2);
  memcpy(header + 24, &sampleRate, 4);
  memcpy(header + 28, &byteRate, 4);
  memcpy(header + 32, &blockAlign, 2);
  memcpy(header + 34, &bitsPerSample, 2);
  memcpy(header + 36, "data", 4);
  memcpy(header + 40, &pcmBytes, 4);
}

bool startVoiceCapture(const String &sessionId, const String &uploadUrl,
                       String &error) {
  if (isBusy) {
    error = "Robot is busy";
    return false;
  }
  if (deviceState.isListening) {
    error = "Voice capture already running";
    return false;
  }
  if (pendingVoiceUpload) {
    error = "Previous voice upload still in progress";
    return false;
  }
  if (uploadUrl == "") {
    error = "uploadUrl is required";
    return false;
  }

  voiceBytesCaptured = 0;
  voiceCaptureStartedAt = millis();
  pendingVoiceUpload = false;
  pendingVoiceUploadUrl = uploadUrl;
  i2s_zero_dma_buffer(I2S_MIC_PORT);
  updateVoiceState(true, "recording", sessionId, "");
  return true;
}

bool stopVoiceCapture(bool autoStopped, String &error) {
  if (!deviceState.isListening) {
    error = "Voice capture is not running";
    return false;
  }

  pendingVoiceUpload = true;
  updateVoiceState(false, "uploading", deviceState.activeVoiceSessionId,
                   deviceState.lastTranscriptPreview);
  if (autoStopped) {
    Serial.println("🎙️ 录音已达到上限，开始上传...");
  } else {
    Serial.println("🎙️ 录音已停止，开始上传...");
  }
  return true;
}

void captureMicrophoneChunk() {
  if (!deviceState.isListening) {
    return;
  }

  uint8_t sampleBuffer[1024];
  size_t bytesRead = 0;
  esp_err_t result =
      i2s_read(I2S_MIC_PORT, sampleBuffer, sizeof(sampleBuffer), &bytesRead, 1);
  if (result != ESP_OK || bytesRead == 0) {
    return;
  }

  size_t writable = min(bytesRead, VOICE_MAX_PCM_BYTES - voiceBytesCaptured);
  if (writable > 0) {
    memcpy(voicePcmBuffer + voiceBytesCaptured, sampleBuffer, writable);
    voiceBytesCaptured += writable;
  }

  if (voiceBytesCaptured >= VOICE_MAX_PCM_BYTES ||
      millis() - voiceCaptureStartedAt >=
          (unsigned long)VOICE_MAX_SECONDS * 1000UL) {
    String error;
    stopVoiceCapture(true, error);
  }
}

bool uploadVoiceCapture(String &error) {
  if (!pendingVoiceUpload) {
    return true;
  }
  pendingVoiceUpload = false;

  if (voiceBytesCaptured == 0) {
    updateVoiceState(false, "failed", "", "");
    error = "No audio captured";
    return false;
  }
  if (pendingVoiceUploadUrl == "") {
    updateVoiceState(false, "failed", "", "");
    error = "Missing upload URL";
    return false;
  }

  const size_t wavBytes = voiceBytesCaptured + 44;
  uint8_t *wavBuffer = (uint8_t *)malloc(wavBytes);
  if (wavBuffer == nullptr) {
    updateVoiceState(false, "failed", "", "");
    error = "Unable to allocate WAV buffer";
    return false;
  }

  writeWavHeader(wavBuffer, voiceBytesCaptured);
  memcpy(wavBuffer + 44, voicePcmBuffer, voiceBytesCaptured);

  HTTPClient http;
  http.begin(pendingVoiceUploadUrl);
  http.addHeader("Content-Type", "audio/wav");
  http.addHeader("X-Otto-Token", deviceToken);
  http.addHeader("X-Audio-Sample-Rate", String(VOICE_SAMPLE_RATE));
  http.setTimeout(45000);
  int code = http.POST(wavBuffer, wavBytes);
  String responseBody = http.getString();
  free(wavBuffer);
  http.end();

  if (code < 200 || code >= 300) {
    updateVoiceState(false, "failed", "", "");
    error = responseBody != "" ? responseBody : "Voice upload failed";
    return false;
  }

  DynamicJsonDocument doc(2048);
  if (deserializeJson(doc, responseBody) == DeserializationError::Ok) {
    String transcript = doc["transcript"] | "";
    updateVoiceState(false, "uploaded", "", transcript);
  } else {
    updateVoiceState(false, "uploaded", "", "");
  }

  pendingVoiceUploadUrl = "";
  voiceBytesCaptured = 0;
  return true;
}

// ================= 命令队列 =================
String nextCommandId() {
  commandCounter += 1;
  return String(millis()) + "-" + String(commandCounter);
}

bool enqueueCommand(const String &kind, const String &payload,
                    String &commandId) {
  xSemaphoreTake(commandMutex, portMAX_DELAY);
  if (commandCount >= COMMAND_QUEUE_CAPACITY) {
    xSemaphoreGive(commandMutex);
    return false;
  }

  commandId = nextCommandId();
  commandQueue[commandTail] = {true, commandId, kind, payload};
  commandTail = (commandTail + 1) % COMMAND_QUEUE_CAPACITY;
  commandCount += 1;
  xSemaphoreGive(commandMutex);
  return true;
}

bool popCommand(CommandItem &command) {
  xSemaphoreTake(commandMutex, portMAX_DELAY);
  if (commandCount == 0) {
    xSemaphoreGive(commandMutex);
    return false;
  }

  command = commandQueue[commandHead];
  commandQueue[commandHead] = {false, "", "", ""};
  commandHead = (commandHead + 1) % COMMAND_QUEUE_CAPACITY;
  commandCount -= 1;
  xSemaphoreGive(commandMutex);
  return true;
}

int pendingCommandCount() {
  xSemaphoreTake(commandMutex, portMAX_DELAY);
  int count = commandCount;
  xSemaphoreGive(commandMutex);
  return count;
}

void sendJson(int statusCode, const String &body) {
  server.send(statusCode, "application/json", body);
}

void sendErrorJson(int statusCode, const String &message) {
  DynamicJsonDocument doc(256);
  doc["ok"] = false;
  doc["error"] = message;
  String body;
  serializeJson(doc, body);
  sendJson(statusCode, body);
}

bool ensureAuthorized() {
  String token = server.header("X-Otto-Token");
  if (token != deviceToken) {
    sendErrorJson(401, "Unauthorized");
    return false;
  }
  return true;
}

bool parseJsonBody(DynamicJsonDocument &doc) {
  if (!server.hasArg("plain")) {
    sendErrorJson(400, "Missing JSON body");
    return false;
  }

  DeserializationError error = deserializeJson(doc, server.arg("plain"));
  if (error) {
    sendErrorJson(400, "Invalid JSON body");
    return false;
  }

  return true;
}

void markRemoteInteraction(const String &queuedAction) {
  lastRemoteCommandAt = millis();
  xSemaphoreTake(stateMutex, portMAX_DELAY);
  if (!deviceState.isBusy) {
    deviceState.currentAction = "queued:" + queuedAction;
  }
  deviceState.lastError = "";
  deviceState.lastTelemetryAtMs = millis();
  xSemaphoreGive(stateMutex);
}

void acceptCommand(const String &kind, const String &payload,
                   const String &queuedAction) {
  String commandId;
  if (!enqueueCommand(kind, payload, commandId)) {
    sendErrorJson(503, "Command queue full");
    return;
  }

  markRemoteInteraction(queuedAction);

  DynamicJsonDocument doc(1024);
  doc["ok"] = true;
  doc["accepted"] = true;
  doc["commandId"] = commandId;
  DynamicJsonDocument statusDoc(768);
  deserializeJson(statusDoc, buildStatusResponseJson(false));
  doc["status"] = statusDoc.as<JsonObject>();
  String body;
  serializeJson(doc, body);
  sendJson(202, body);
}

bool enqueueInternalCommand(const String &kind, const String &payload) {
  String commandId;
  if (!enqueueCommand(kind, payload, commandId)) {
    Serial.printf("❌ 内部命令入队失败: %s\n", kind.c_str());
    return false;
  }
  return true;
}

// ================= 自动剧场 =================
void endPhase() {
  waitForSpeechCompletion();
  for (int i = 0; i < 6; i++) {
    osc[i].setParams(0, 0, 0, 1000);
  }
  goHomeSmooth(800);
  delay(300);
}

void playFlow1() {
  Serial.println(">> 阶段三：运势大吉");
  speakAsync("运势大吉，天选早八人！");
  actionHeroPose(3000);
  endPhase();

  Serial.println(">> 阶段四：精神良好");
  speakAsync("今天自然醒在闹钟前3分钟，精神良好。");
  actionFullBodyWave(2, 2000);
  endPhase();

  Serial.println(">> 阶段五：幸运冰美式");
  speakAsync("幸运物冰美式，老师点名啦。");
  actionStompLeft(2000);
  actionCheer(5);
  endPhase();

  Serial.println(">> 阶段六：拜拜");
  speakAsync("祝你运气爆棚，拜拜～");
  actionWaveGoodbye(3);
  endPhase();
}

void playFlow2() {
  Serial.println(">> 阶段三：放过自己");
  speakAsync("建议休息，放过自己。");
  actionSleep(4000);
  endPhase();

  Serial.println(">> 阶段四：关机散热");
  speakAsync("你不是机器，也该关机散热了。");
  actionSymmetricHips(2, 1200, 500);
  endPhase();

  Serial.println(">> 阶段五：睡够8小时");
  speakAsync("允许今晚不学习，睡够8小时。");
  actionSoothe(4000);
  endPhase();

  Serial.println(">> 阶段六：晚安");
  speakAsync("今天唯一任务是休息。晚安～");
  actionWaveGoodbye(3);
  endPhase();
}

void playFlow3() {
  Serial.println(">> 阶段三：三米之内");
  speakAsync("人际Crush，三米之内。");
  actionMoonwalk(3, 1200, 1);
  endPhase();

  Serial.println(">> 阶段四：方位确认");
  speakAsync("Crush正在附近三米范围内。");
  actionTwistHip(2, 250, 150);
  actionCheer(5);
  endPhase();

  Serial.println(">> 阶段五：表情管理");
  speakAsync("注意表情管理，别整理刘海。");
  actionWalk(2, 1000, false);
  goHomeSmooth(500);
  delay(500);
  actionStompRight(2000);
  endPhase();

  Serial.println(">> 阶段六：祝你好运");
  speakAsync("勇敢一点，祝你好运哦～");
  actionWaveGoodbye(3);
  endPhase();
}

bool parseFortuneChoice(const String &rawCommand, char &choice) {
  String command = rawCommand;
  command.trim();
  command.toLowerCase();

  if (command == "1" || command == "sign1" || command == "fortune1") {
    choice = '1';
    return true;
  }
  if (command == "2" || command == "sign2" || command == "fortune2") {
    choice = '2';
    return true;
  }
  if (command == "3" || command == "sign3" || command == "fortune3") {
    choice = '3';
    return true;
  }

  return false;
}

void setBusyState(bool busy, const String &action, const String &error = "") {
  isBusy = busy;
  refreshTelemetry(false);
  updateDeviceState(busy, action, error, deviceState.distanceCm,
                    deviceState.signalStrength, 84, 42,
                    memoryPercentFromHeap());
}

void runInteractiveTheater(char choice) {
  Serial.println("\n▶️ 剧场开始执行...");

  Serial.println(">> 阶段一：打招呼");
  speakAsync("你好呀，我是小O，抽支运势签吧～");
  actionDoubleGreet(2);
  actionWalk(2, 1200, true);
  endPhase();

  Serial.println(">> 阶段二：感应磁场");
  speakAsync("感应磁场中...");
  actionShakeLegRight(2500);
  endPhase();

  Serial.printf("\n🎯 用户选择了签文：[%c]\n", choice);
  if (choice == '1')
    playFlow1();
  else if (choice == '2')
    playFlow2();
  else if (choice == '3')
    playFlow3();
  Serial.println("⏹️ 剧场结束，恢复雷达监测。");
}

void runProximityGreeting() {
  Serial.println("\n👋 检测到有人靠近，执行简短问候...");
  speakAsync("你好呀，我是o神。要不要来抽一支签呀");
  actionDoubleGreet(2);
  endPhase();
  Serial.println("⏹️ 问候完成，继续待机监测。");
}

// ================= 远程动作执行 =================
int getIntParam(JsonVariantConst params, const char *key, int fallback,
                int minimum, int maximum) {
  if (params[key].isNull())
    return fallback;
  int value = params[key].as<int>();
  return constrain(value, minimum, maximum);
}

bool getBoolParam(JsonVariantConst params, const char *key, bool fallback) {
  if (params[key].isNull())
    return fallback;
  return params[key].as<bool>();
}

String getStringParam(JsonVariantConst params, const char *key,
                      const String &fallback) {
  if (params[key].isNull())
    return fallback;
  return params[key].as<String>();
}

bool executeNamedAction(const String &actionKey, JsonVariantConst params,
                        String &error) {
  if (actionKey == "actionWaveGoodbye") {
    actionWaveGoodbye(getIntParam(params, "repetitions", 3, 1, 8),
                      getIntParam(params, "amplitude", 16, 8, 24),
                      getIntParam(params, "tempo", 1000, 600, 1600),
                      getIntParam(params, "armBias", 45, 25, 60),
                      getStringParam(params, "style", "classic"));
  } else if (actionKey == "actionDoubleGreet") {
    actionDoubleGreet(getIntParam(params, "repetitions", 3, 1, 8),
                      getIntParam(params, "amplitude", 15, 8, 22),
                      getIntParam(params, "tempo", 1200, 700, 1800),
                      getIntParam(params, "armBias", 15, 5, 25));
  } else if (actionKey == "actionCheer") {
    actionCheer(getIntParam(params, "repetitions", 8, 1, 12),
                getIntParam(params, "amplitude", 8, 4, 14),
                getIntParam(params, "tempo", 400, 220, 800),
                getStringParam(params, "style", "bright"));
  } else if (actionKey == "actionWalk") {
    actionWalk(getIntParam(params, "steps", 4, 1, 8),
               getIntParam(params, "period", 1500, 800, 2400),
               getBoolParam(params, "isForward", true));
  } else if (actionKey == "actionTwistHip") {
    actionTwistHip(getIntParam(params, "cycles", 4, 1, 8),
                   getIntParam(params, "moveTime", 250, 120, 500),
                   getIntParam(params, "pauseTime", 150, 60, 300),
                   getStringParam(params, "style", "classic"));
  } else if (actionKey == "actionFullBodyWave") {
    actionFullBodyWave(getIntParam(params, "cycles", 3, 1, 6),
                       getIntParam(params, "tempo", 2000, 1200, 2800));
  } else if (actionKey == "actionSleep") {
    actionSleep(getIntParam(params, "duration", 12000, 4000, 20000));
  } else if (actionKey == "actionHeroPose") {
    actionHeroPose(getIntParam(params, "holdTime", 4000, 1000, 8000));
  } else if (actionKey == "actionBow") {
    actionBow(getIntParam(params, "cycles", 2, 1, 5),
              getIntParam(params, "depth", 22, 10, 32),
              getIntParam(params, "moveTime", 520, 260, 900),
              getIntParam(params, "holdTime", 260, 120, 1000));
  } else if (actionKey == "actionOpenArms") {
    actionOpenArms(getIntParam(params, "cycles", 3, 1, 6),
                   getIntParam(params, "armSpread", 42, 20, 60),
                   getIntParam(params, "tempo", 1200, 700, 1800),
                   getIntParam(params, "sway", 8, 0, 16));
  } else if (actionKey == "actionMarch") {
    actionMarch(getIntParam(params, "steps", 6, 2, 12),
                getIntParam(params, "lift", 18, 8, 26),
                getIntParam(params, "tempo", 700, 420, 1200),
                getIntParam(params, "armSwing", 18, 0, 30));
  } else if (actionKey == "actionLeanGroove") {
    actionLeanGroove(getIntParam(params, "cycles", 4, 2, 8),
                     getIntParam(params, "lean", 18, 8, 28),
                     getIntParam(params, "tempo", 850, 500, 1400),
                     getIntParam(params, "armBias", 24, 8, 36));
  } else if (actionKey == "actionSalute") {
    actionSalute(getIntParam(params, "cycles", 2, 1, 5),
                 getIntParam(params, "armBias", 52, 36, 68),
                 getIntParam(params, "holdTime", 350, 120, 1000));
  } else if (actionKey == "actionPresentLeft") {
    actionPresentLeft(getIntParam(params, "cycles", 2, 1, 5),
                      getIntParam(params, "armSpread", 42, 24, 62),
                      getIntParam(params, "holdTime", 420, 160, 1200));
  } else if (actionKey == "actionPresentRight") {
    actionPresentRight(getIntParam(params, "cycles", 2, 1, 5),
                       getIntParam(params, "armSpread", 42, 24, 62),
                       getIntParam(params, "holdTime", 420, 160, 1200));
  } else if (actionKey == "actionShrug") {
    actionShrug(getIntParam(params, "cycles", 4, 2, 8),
                getIntParam(params, "amplitude", 10, 4, 16),
                getIntParam(params, "tempo", 700, 400, 1200));
  } else if (actionKey == "actionDiscoPoint") {
    actionDiscoPoint(getIntParam(params, "cycles", 4, 2, 8),
                     getIntParam(params, "tempo", 760, 450, 1300),
                     getIntParam(params, "armBias", 40, 22, 58),
                     getIntParam(params, "lean", 18, 8, 26));
  } else if (actionKey == "actionCrossStep") {
    actionCrossStep(getIntParam(params, "cycles", 4, 2, 8),
                    getIntParam(params, "lean", 16, 8, 24),
                    getIntParam(params, "tempo", 900, 550, 1500));
  } else if (actionKey == "actionTiptoeBounce") {
    actionTiptoeBounce(getIntParam(params, "cycles", 6, 2, 12),
                       getIntParam(params, "amplitude", 10, 4, 16),
                       getIntParam(params, "tempo", 420, 220, 800));
  } else if (actionKey == "actionPowerStance") {
    actionPowerStance(getIntParam(params, "holdTime", 3200, 1200, 7000),
                      getIntParam(params, "armSpread", 24, 10, 36),
                      getIntParam(params, "lean", 16, 8, 24));
  } else if (actionKey == "actionPeekaboo") {
    actionPeekaboo(getIntParam(params, "cycles", 3, 1, 6),
                   getIntParam(params, "armBias", 38, 20, 50),
                   getIntParam(params, "tempo", 700, 420, 1200));
  } else if (actionKey == "actionSwayWelcome") {
    actionSwayWelcome(getIntParam(params, "cycles", 4, 2, 8),
                      getIntParam(params, "armSpread", 36, 18, 56),
                      getIntParam(params, "tempo", 1100, 700, 1700),
                      getIntParam(params, "sway", 12, 4, 18));
  } else {
    error = String("Unsupported action key: ") + actionKey;
    return false;
  }
  return true;
}

bool executeMoveCommand(const String &direction, String &error) {
  if (direction == "forward") {
    actionWalk(2, 1200, true);
  } else if (direction == "backward") {
    actionWalk(2, 1200, false);
  } else if (direction == "left") {
    actionMoonwalk(2, 1100, 1);
  } else if (direction == "right") {
    actionMoonwalk(2, 1100, -1);
  } else {
    error = String("Unsupported direction: ") + direction;
    return false;
  }
  goHomeSmooth(600);
  return true;
}

bool executeSpeakCommand(const String &text, String &error) {
  if (text == "") {
    error = "Speak text is required";
    return false;
  }
  speakAsync(text);
  waitForSpeechCompletion();
  return true;
}

bool executeSequenceSteps(JsonArrayConst steps, String &error) {
  int previousOffset = 0;
  for (JsonObjectConst step : steps) {
    int offsetMs = step["offsetMs"] | previousOffset;
    if (offsetMs > previousOffset) {
      delay(offsetMs - previousOffset);
    }

    String actionKey = step["actionKey"] | "";
    if (actionKey == "") {
      error = "Sequence step missing actionKey";
      return false;
    }

    if (!executeNamedAction(actionKey, step["params"], error)) {
      return false;
    }
    previousOffset = offsetMs;
  }
  return true;
}

bool executeCommand(const CommandItem &command, String &error) {
  DynamicJsonDocument doc(4096);
  if (command.payload != "") {
    DeserializationError jsonError = deserializeJson(doc, command.payload);
    if (jsonError) {
      error = "Invalid queued JSON payload";
      return false;
    }
  }

  if (command.kind == "action") {
    String actionKey = doc["actionKey"] | "";
    if (actionKey == "") {
      error = "Missing actionKey";
      return false;
    }
    setBusyState(true, actionKey);
    if (!executeNamedAction(actionKey, doc["params"], error))
      return false;
    endPhase();
    setBusyState(false, actionKey);
  } else if (command.kind == "move") {
    String direction = doc["direction"] | "";
    if (direction == "") {
      error = "Missing direction";
      return false;
    }
    setBusyState(true, "move:" + direction);
    if (!executeMoveCommand(direction, error))
      return false;
    setBusyState(false, "move:" + direction);
  } else if (command.kind == "speak") {
    String text = doc["text"] | "";
    setBusyState(true, "speak");
    if (!executeSpeakCommand(text, error))
      return false;
    setBusyState(false, "speak");
  } else if (command.kind == "calibrate") {
    setBusyState(true, "calibrate");
    goHomeSmooth(1200);
    delay(200);
    setBusyState(false, "calibrate");
  } else if (command.kind == "sequence") {
    JsonArrayConst steps = doc["steps"].as<JsonArrayConst>();
    if (steps.isNull()) {
      error = "Missing sequence steps";
      return false;
    }
    setBusyState(true, "execute-sequence");
    if (!executeSequenceSteps(steps, error))
      return false;
    endPhase();
    setBusyState(false, "execute-sequence");
  } else if (command.kind == "theater") {
    String choiceValue = doc["choice"] | "1";
    char choice = choiceValue.length() > 0 ? choiceValue.charAt(0) : '1';
    if (choice != '1' && choice != '2' && choice != '3') {
      error = "Invalid theater choice";
      return false;
    }
    setBusyState(true, "interactive-theater");
    runInteractiveTheater(choice);
    setBusyState(false, "interactive-theater");
  } else if (command.kind == "proximity-greet") {
    setBusyState(true, "proximity-greet");
    runProximityGreeting();
    setBusyState(false, "proximity-greet");
  } else {
    error = String("Unsupported command kind: ") + command.kind;
    return false;
  }
  return true;
}

void commandTask(void *pvParameters) {
  while (true) {
    CommandItem command;
    if (!popCommand(command)) {
      vTaskDelay(20 / portTICK_PERIOD_MS);
      continue;
    }

    String error;
    if (!executeCommand(command, error)) {
      Serial.printf("❌ 命令执行失败: %s\n", error.c_str());
      setBusyState(false, deviceState.currentAction, error);
    }
  }
}

// ================= HTTP API =================
void handleHealth() {
  if (!ensureAuthorized())
    return;
  DynamicJsonDocument doc(256);
  doc["ok"] = true;
  doc["device"] = "otto-esp32";
  doc["firmwareVersion"] = deviceState.firmwareVersion;
  String body;
  serializeJson(doc, body);
  sendJson(200, body);
}

void handleStatus() {
  if (!ensureAuthorized())
    return;
  refreshTelemetry(true);
  sendJson(200, buildStatusResponseJson(true));
}

void handleActionCommand() {
  if (!ensureAuthorized())
    return;
  if (deviceState.isListening) {
    sendErrorJson(409, "Robot is currently listening");
    return;
  }
  DynamicJsonDocument doc(1024);
  if (!parseJsonBody(doc))
    return;
  String actionKey = doc["actionKey"] | "";
  if (actionKey == "") {
    sendErrorJson(400, "actionKey is required");
    return;
  }
  acceptCommand("action", server.arg("plain"), actionKey);
}

void handleMoveCommand() {
  if (!ensureAuthorized())
    return;
  if (deviceState.isListening) {
    sendErrorJson(409, "Robot is currently listening");
    return;
  }
  DynamicJsonDocument doc(256);
  if (!parseJsonBody(doc))
    return;
  String direction = doc["direction"] | "";
  if (direction == "") {
    sendErrorJson(400, "direction is required");
    return;
  }
  acceptCommand("move", server.arg("plain"), "move:" + direction);
}

void handleSpeakCommand() {
  if (!ensureAuthorized())
    return;
  if (deviceState.isListening) {
    sendErrorJson(409, "Robot is currently listening");
    return;
  }
  DynamicJsonDocument doc(1024);
  if (!parseJsonBody(doc))
    return;
  String text = doc["text"] | "";
  if (text == "") {
    sendErrorJson(400, "text is required");
    return;
  }
  acceptCommand("speak", server.arg("plain"), "speak");
}

void handleCalibrateCommand() {
  if (!ensureAuthorized())
    return;
  if (deviceState.isListening) {
    sendErrorJson(409, "Robot is currently listening");
    return;
  }
  String payload =
      server.hasArg("plain") ? server.arg("plain") : "{\"mode\":\"full\"}";
  acceptCommand("calibrate", payload, "calibrate");
}

void handleSequenceCommand() {
  if (!ensureAuthorized())
    return;
  if (deviceState.isListening) {
    sendErrorJson(409, "Robot is currently listening");
    return;
  }
  DynamicJsonDocument doc(4096);
  if (!parseJsonBody(doc))
    return;
  if (doc["steps"].isNull()) {
    sendErrorJson(400, "steps array is required");
    return;
  }
  acceptCommand("sequence", server.arg("plain"), "execute-sequence");
}

void handleTheaterCommand() {
  if (!ensureAuthorized())
    return;
  if (deviceState.isListening) {
    sendErrorJson(409, "Robot is currently listening");
    return;
  }
  DynamicJsonDocument doc(256);
  if (!parseJsonBody(doc))
    return;
  String choice = doc["choice"] | "";
  if (choice != "1" && choice != "2" && choice != "3") {
    sendErrorJson(400, "choice must be 1, 2, or 3");
    return;
  }
  acceptCommand("theater", server.arg("plain"), "interactive-theater");
}

void handleListenStartCommand() {
  if (!ensureAuthorized())
    return;
  DynamicJsonDocument doc(1024);
  if (!parseJsonBody(doc))
    return;

  String sessionId = doc["sessionId"] | "";
  String uploadUrl = doc["uploadUrl"] | "";
  if (sessionId == "" || uploadUrl == "") {
    sendErrorJson(400, "sessionId and uploadUrl are required");
    return;
  }

  String error;
  if (!startVoiceCapture(sessionId, uploadUrl, error)) {
    sendErrorJson(409, error);
    return;
  }

  lastRemoteCommandAt = millis();
  DynamicJsonDocument body(1024);
  body["ok"] = true;
  body["accepted"] = true;
  body["commandId"] = nextCommandId();
  DynamicJsonDocument statusDoc(768);
  deserializeJson(statusDoc, buildStatusResponseJson(false));
  body["status"] = statusDoc.as<JsonObject>();
  String json;
  serializeJson(body, json);
  sendJson(202, json);
}

void handleListenStopCommand() {
  if (!ensureAuthorized())
    return;
  String error;
  if (!stopVoiceCapture(false, error)) {
    sendErrorJson(409, error);
    return;
  }

  lastRemoteCommandAt = millis();
  DynamicJsonDocument body(1024);
  body["ok"] = true;
  body["accepted"] = true;
  body["commandId"] = nextCommandId();
  DynamicJsonDocument statusDoc(768);
  deserializeJson(statusDoc, buildStatusResponseJson(false));
  body["status"] = statusDoc.as<JsonObject>();
  String json;
  serializeJson(body, json);
  sendJson(202, json);
}

void configureHttpServer() {
  const char *headerKeys[] = {"X-Otto-Token"};
  server.collectHeaders(headerKeys, 1);
  server.on("/health", HTTP_GET, handleHealth);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/commands/action", HTTP_POST, handleActionCommand);
  server.on("/commands/move", HTTP_POST, handleMoveCommand);
  server.on("/commands/speak", HTTP_POST, handleSpeakCommand);
  server.on("/commands/calibrate", HTTP_POST, handleCalibrateCommand);
  server.on("/commands/sequence", HTTP_POST, handleSequenceCommand);
  server.on("/commands/theater", HTTP_POST, handleTheaterCommand);
  server.on("/commands/listen/start", HTTP_POST, handleListenStartCommand);
  server.on("/commands/listen/stop", HTTP_POST, handleListenStopCommand);
  server.onNotFound([]() { sendErrorJson(404, "Not found"); });
  server.begin();
}

// ================= 系统初始化 =================
void setup() {
  Serial.begin(115200);
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);

  commandMutex = xSemaphoreCreateMutex();
  stateMutex = xSemaphoreCreateMutex();

  initOtto();

  WiFi.begin(wifi_name, wifi_password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.printf("✅ WiFi已连接，IP地址: %s\n",
                WiFi.localIP().toString().c_str());

  i2s_config_t amp_cfg = {.mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
                          .sample_rate = 8000,
                          .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
                          .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,
                          .communication_format = I2S_COMM_FORMAT_STAND_I2S,
                          .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
                          .dma_buf_count = 8,
                          .dma_buf_len = 512,
                          .use_apll = false,
                          .tx_desc_auto_clear = true};
  i2s_pin_config_t amp_p = {.mck_io_num = I2S_PIN_NO_CHANGE,
                            .bck_io_num = AMP_BCLK,
                            .ws_io_num = AMP_LRC,
                            .data_out_num = AMP_DIN,
                            .data_in_num = I2S_PIN_NO_CHANGE};
  i2s_driver_install(I2S_AMP_PORT, &amp_cfg, 0, NULL);
  i2s_set_pin(I2S_AMP_PORT, &amp_p);
  initMicrophone();

  HTTPClient httpAuth;
  String url = "https://aip.baidubce.com/oauth/2.0/"
               "token?grant_type=client_credentials&client_id=" +
               String(baiduAK) + "&client_secret=" + String(baiduSK);
  httpAuth.begin(url);
  if (httpAuth.POST("") == 200) {
    DynamicJsonDocument doc(1024);
    deserializeJson(doc, httpAuth.getString());
    baiduAccessToken = doc["access_token"].as<String>();
  }
  httpAuth.end();

  configureHttpServer();
  refreshTelemetry(true);

  xTaskCreatePinnedToCore(ttsTask, "TTS_Task", 10000, NULL, 1, NULL, 0);
  xTaskCreatePinnedToCore(commandTask, "Command_Task", 12000, NULL, 1, NULL, 1);

  Serial.println("✅ HTTP设备接口已启动");
  Serial.printf("🔐 设备Token: %s\n", deviceToken);
  Serial.println("✅ 串口签文触发已启用：输入 1/2/3 或 sign1/sign2/sign3");
  Serial.println("✅ 麦克风录音接口已启用：/commands/listen/start 与 "
                 "/commands/listen/stop");
}

void loop() {
  server.handleClient();
  captureMicrophoneChunk();

  if (millis() - lastTelemetryRefreshAt > 1000) {
    lastTelemetryRefreshAt = millis();
    refreshTelemetry(true);
  }

  if (!deviceState.isListening && pendingVoiceUpload) {
    String error;
    if (!uploadVoiceCapture(error)) {
      Serial.printf("❌ 语音上传失败: %s\n", error.c_str());
    } else {
      Serial.println("✅ 语音上传完成");
    }
  }

  float latestDistance = deviceState.distanceCm;
  bool withinGreetingRange = latestDistance >= PROXIMITY_GREETING_MIN_CM &&
                             latestDistance <= PROXIMITY_GREETING_MAX_CM;
  bool remoteCooldownActive =
      millis() - lastRemoteCommandAt < REMOTE_CONTROL_COOLDOWN_MS;
  bool greetCooldownActive =
      millis() - lastProximityGreetingAt < PROXIMITY_GREETING_COOLDOWN_MS;

  if (!withinGreetingRange && proximityGreetingLatched) {
    proximityGreetingLatched = false;
  }

  if (withinGreetingRange && !proximityGreetingLatched && !isBusy &&
      !deviceState.isListening && pendingCommandCount() == 0 &&
      !remoteCooldownActive && !greetCooldownActive) {
    proximityGreetingLatched = true;
    lastProximityGreetingAt = millis();
    enqueueInternalCommand("proximity-greet", "{}");
  }

  if (!isBusy && pendingCommandCount() == 0 && Serial.available() > 0) {
    String serialCommand = Serial.readStringUntil('\n');
    char choice = '0';
    if (parseFortuneChoice(serialCommand, choice)) {
      DynamicJsonDocument doc(64);
      doc["choice"] = String(choice);
      String payload;
      serializeJson(doc, payload);
      Serial.printf("\n🎯 串口触发签文：[%c]\n", choice);
      enqueueInternalCommand("theater", payload);
    } else {
      serialCommand.trim();
      if (serialCommand != "") {
        Serial.printf("⚠️ 未识别的串口命令: %s\n", serialCommand.c_str());
        Serial.println("请输入 1/2/3 或 sign1/sign2/sign3");
      }
    }
  }

  delay(20);
}
