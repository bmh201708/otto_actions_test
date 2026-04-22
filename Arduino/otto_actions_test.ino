#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <driver/i2s.h>
#include "ottoactions.h" 

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

const char* wifi_name = "lgrrr";
const char* wifi_password = "999999999"; 
const char* baiduAK = "rNrzpMFagAtyTudGiq58M3NH";
const char* baiduSK = "BGO8ABwxIm2k3lNYISWw445o3hhXwx15";

String baiduAccessToken = "";
bool isBusy = false; 

// ================= 🌟 双核语音异步引擎 =================
volatile bool isSpeaking = false; 
String speechQueue = "";

void speakBlocking(String text) {
  if (text == "") return;
  HTTPClient httpTTS; 
  httpTTS.begin("http://tsn.baidu.com/text2audio");
  httpTTS.addHeader("Content-Type", "application/x-www-form-urlencoded");
  
  String encodedText = "";
  for (char c : text) {
    if (isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') encodedText += c;
    else { char buf[4]; sprintf(buf, "%%%02X", (unsigned char)c); encodedText += buf; }
  }

  String payload = "tex=" + encodedText + "&lan=zh&cuid=otto&ctp=1&tok=" + baiduAccessToken + "&per=0&spd=5&vol=15&aue=5";
  int code = httpTTS.POST(payload);
  if (code == 200) {
    int len = httpTTS.getSize();
    WiFiClient *stream = httpTTS.getStreamPtr();
    uint8_t m[1024]; int16_t s[1024]; int down = 0;
    while (httpTTS.connected() && down < len) {
      if (stream->available()) {
        int r = stream->readBytes(m, min(1024, len - down));
        int sam = (r & ~1) / 2;
        int16_t* pcm = (int16_t*)m;
        for (int i = 0; i < sam; i++) { s[i*2] = pcm[i]; s[i*2+1] = pcm[i]; }
        size_t w; i2s_write(I2S_AMP_PORT, s, sam * 4, &w, portMAX_DELAY);
        down += r;
      }
    }
  }
  httpTTS.end(); delay(200); i2s_zero_dma_buffer(I2S_AMP_PORT);
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

// ================= 🛡️ 阶段严格收尾 =================
void endPhase() {
  while (isSpeaking || speechQueue != "") { delay(10); yield(); } // 等待语音
  for (int i = 0; i < 6; i++) { osc[i].setParams(0, 0, 0, 1000); } // 杀死幽灵动作
  goHomeSmooth(800); // 强制回中立位
  delay(300);
}


// ================= 🎬 流程 1 后半段：早八人 =================
void playFlow1() {
  Serial.println(">> 阶段三：运势大吉");
  speakAsync("运势大吉，天选早八人！"); 
  actionHeroPose(3000); endPhase();

  Serial.println(">> 阶段四：精神良好");
  speakAsync("今天自然醒在闹钟前3分钟，精神良好。");
  actionFullBodyWave(2, 2000); endPhase();

  Serial.println(">> 阶段五：幸运冰美式");
  speakAsync("幸运物冰美式，老师点名啦。");
  actionStompLeft(2000); actionCheer(5); endPhase();

  Serial.println(">> 阶段六：拜拜");
  speakAsync("祝你运气爆棚，拜拜～");
  actionWaveGoodbye(3); endPhase();
}

// ================= 🎬 流程 2 后半段：治愈关机 =================
void playFlow2() {
  Serial.println(">> 阶段三：放过自己");
  speakAsync("建议休息，放过自己。"); 
  actionSleep(4000); endPhase(); // 睡眠律动4秒

  Serial.println(">> 阶段四：关机散热");
  speakAsync("你不是机器，也该关机散热了。");
  actionSymmetricHips(2, 1200, 500); endPhase(); // 缓慢开合2次

  Serial.println(">> 阶段五：睡够8小时");
  speakAsync("允许今晚不学习，睡够8小时。");
  actionSoothe(4000); endPhase(); // 安抚模式摇摆4秒

  Serial.println(">> 阶段六：晚安");
  speakAsync("今天唯一任务是休息。晚安～");
  actionWaveGoodbye(3); endPhase();
}

// ================= 🎬 流程 3 后半段：偶遇 Crush =================
void playFlow3() {
  Serial.println(">> 阶段三：三米之内");
  speakAsync("人际Crush，三米之内。"); 
  actionMoonwalk(3, 1200, 1); endPhase(); // 慌乱的太空步

  Serial.println(">> 阶段四：方位确认");
  speakAsync("Crush正在附近三米范围内。");
  actionTwistHip(2, 250, 150); // 扭胯2秒
  actionCheer(5); // 紧接着欢呼2秒
  endPhase();

  Serial.println(">> 阶段五：表情管理");
  speakAsync("注意表情管理，别整理刘海。");
  actionWalk(2, 1000, false); // false代表后退！退两步
  goHomeSmooth(500); delay(500); // 迅速回正并定格0.5秒装作无事发生
  actionStompRight(2000); // 然后右脚急躁地跺脚2秒
  endPhase();

  Serial.println(">> 阶段六：祝你好运");
  speakAsync("勇敢一点，祝你好运哦～");
  actionWaveGoodbye(3); endPhase();
}


// ================= 🧠 主剧场流程控制 =================
void runInteractiveTheater() {
  isBusy = true;
  Serial.println("\n▶️ 剧场开始执行...");

  // --- 公共 阶段一 ---
  Serial.println(">> 阶段一：打招呼");
  speakAsync("你好呀，我是小O，抽支运势签吧～"); 
  actionDoubleGreet(2); actionWalk(2, 1200, true); 
  endPhase();

  // --- 公共 阶段二 ---
  Serial.println(">> 阶段二：感应磁场");
  speakAsync("感应磁场中...");
  actionShakeLegRight(2500); 
  endPhase();

  // --- 串口分支选择 ---
  Serial.println("\n=================================");
  Serial.println("🤖 欧神已就绪，等待串口选择签文：");
  Serial.println("输入 1 -> 【运势大吉：早八人】");
  Serial.println("输入 2 -> 【建议休息：关机散热】");
  Serial.println("输入 3 -> 【人际偶遇：Crush出现】");
  Serial.println("=================================");
  
  // 清空串口缓存中多余的回车换行符
  while (Serial.available()) { Serial.read(); }
  
  char choice = '0';
  while (true) {
    if (Serial.available() > 0) {
      choice = Serial.read();
      if (choice == '1' || choice == '2' || choice == '3') break;
    }
    delay(50);
  }

  // --- 根据选择进入不同结局 ---
  Serial.printf("\n🎯 用户选择了签文：[%c]\n", choice);
  if (choice == '1') {
    playFlow1();
  } else if (choice == '2') {
    playFlow2();
  } else if (choice == '3') {
    playFlow3();
  }

  isBusy = false;
  Serial.println("⏹️ 剧场结束，恢复雷达监测。");
}

// ================= 系统初始化 =================
void setup() {
  Serial.begin(115200);
  pinMode(PIN_TRIG, OUTPUT); pinMode(PIN_ECHO, INPUT);
  
  initOtto(); // 初始化动作库

  WiFi.begin(wifi_name, wifi_password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }

  i2s_config_t amp_cfg = { .mode = (i2s_mode_t)(I2S_MODE_MASTER|I2S_MODE_TX), .sample_rate = 8000, .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT, .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT, .communication_format = I2S_COMM_FORMAT_STAND_I2S, .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1, .dma_buf_count = 8, .dma_buf_len = 512, .use_apll = false, .tx_desc_auto_clear = true };
  i2s_pin_config_t amp_p = { .mck_io_num = I2S_PIN_NO_CHANGE, .bck_io_num = AMP_BCLK, .ws_io_num = AMP_LRC, .data_out_num = AMP_DIN, .data_in_num = I2S_PIN_NO_CHANGE };
  i2s_driver_install(I2S_AMP_PORT, &amp_cfg, 0, NULL); i2s_set_pin(I2S_AMP_PORT, &amp_p);

  HTTPClient httpAuth;
  String url = "https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=" + String(baiduAK) + "&client_secret=" + String(baiduSK);
  httpAuth.begin(url);
  if (httpAuth.POST("") == 200) {
    DynamicJsonDocument doc(1024); deserializeJson(doc, httpAuth.getString());
    baiduAccessToken = doc["access_token"].as<String>();
  }
  httpAuth.end();

  xTaskCreatePinnedToCore(ttsTask, "TTS_Task", 10000, NULL, 1, NULL, 0);
  
  Serial.println("\n✅ 雷达监测就绪，请触发...");
}

unsigned long lastT = 0;
void loop() {
  if (!isBusy) {
    digitalWrite(PIN_TRIG, LOW); delayMicroseconds(2);
    digitalWrite(PIN_TRIG, HIGH); delayMicroseconds(10);
    digitalWrite(PIN_TRIG, LOW);

    long duration = pulseIn(PIN_ECHO, HIGH, 30000); 
    float d = 0;
    if (duration > 0) d = duration * 0.034 / 2;

    if (millis() - lastT > 1000) { lastT = millis(); }
    
    if (d > 2.0 && d < 15.0) {
      Serial.printf("\n🎯 触发距离: %.2f cm！进入剧场...\n", d);
      runInteractiveTheater();
    }
  }
  delay(100);
}