#ifndef OTTO_ACTIONS_H
#define OTTO_ACTIONS_H

#include <ESP32Servo.h>

// ==========================================
// 1. 硬件引脚与全局变量定义
// ==========================================
const int PIN_LH = 13;
const int PIN_RH = 12; // 0, 1: 胯部
const int PIN_LF = 14;
const int PIN_RF = 27; // 2, 3: 脚部
const int PIN_LA = 26;
const int PIN_RA = 25; // 4, 5: 手臂

Servo servos[6];
// 核心：永远记录机器人当前真实的物理角度，保障动作切换平滑
float currentPos[6] = {90, 90, 90, 90, 90, 90};

// ==========================================
// 2. 统一运动引擎 (Oscillator)
// ==========================================
class Oscillator {
public:
  int _A, _O, _T;
  double _phase, _phase0, _inc;
  unsigned long _prevMs;

  void setParams(int A, int O, double Ph, int T) {
    _A = A;
    _O = O;
    _phase0 = Ph;
    _T = T;
    _inc = (2.0 * PI) / (_T / 30.0);
    _phase = 0;
  }

  // 统合了普通正弦波和手臂电流舞(Pop)的刷新逻辑
  void refresh(int index, bool isArmPop = false, bool isRightArm = false) {
    if (millis() - _prevMs >= 30) {
      _prevMs = millis();
      float wave = sin(_phase + _phase0);
      float target = 90;

      if (isArmPop) {
        float armWave = max(0.0f, wave); // 只取上半波峰
        target = isRightArm ? (90 - _A * armWave) : (90 + _A * armWave);
      } else {
        target = 90 + _O + _A * wave;
      }

      servos[index].write(target);
      currentPos[index] = target; // 实时同步物理位置
      _phase += _inc;
    }
  }
};

Oscillator osc[6];

// ==========================================
// 3. 基础驱动与过渡函数
// ==========================================

// 初始化机器人 (在主程序的 setup 中调用)
void initOtto() {
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);
  int pins[6] = {PIN_LH, PIN_RH, PIN_LF, PIN_RF, PIN_LA, PIN_RA};
  for (int i = 0; i < 6; i++) {
    servos[i].setPeriodHertz(50);
    servos[i].attach(pins[i], 500, 2500);
    servos[i].write(90);
    currentPos[i] = 90;
  }
}

// 核心：平滑移动到任意姿势
void smoothMove(float targets[], int moveTime) {
  float startPos[6];
  for (int i = 0; i < 6; i++)
    startPos[i] = currentPos[i];
  unsigned long start = millis();
  while (millis() - start < moveTime) {
    float progress = (float)(millis() - start) / moveTime;
    for (int i = 0; i < 6; i++) {
      float angle = startPos[i] + (targets[i] - startPos[i]) * progress;
      servos[i].write(angle);
      currentPos[i] = angle;
    }
    delay(15);
    yield();
  }
  // 终点精确对齐
  for (int i = 0; i < 6; i++) {
    servos[i].write(targets[i]);
    currentPos[i] = targets[i];
  }
}

// 平滑回到中立位
void goHomeSmooth(int duration = 1000) {
  float homePos[6] = {90, 90, 90, 90, 90, 90};
  smoothMove(homePos, duration);
}

// Oscillator 引擎执行时长控制
void playGesture(int duration) {
  unsigned long start = millis();
  while (millis() - start < duration) {
    for (int i = 0; i < 6; i++)
      osc[i].refresh(i);
    yield();
  }
}

int adjustAmplitudeForStyle(const String &style, int amplitude,
                            int gentleDelta = -2, int energeticDelta = 2) {
  if (style == "gentle" || style == "tight")
    return max(1, amplitude + gentleDelta);
  if (style == "energetic" || style == "dramatic" || style == "pumped" ||
      style == "victory")
    return amplitude + energeticDelta;
  return amplitude;
}

// ==========================================
// 4. 欧神动作库 (Otto Actions)
// ==========================================

// 🚀 动作：前进 / 后退
void actionWalk(int steps = 4, int period = 1500, bool isForward = true) {
  int A_hip = 20;
  int A_foot = 30;
  unsigned long startTime = millis();
  unsigned long duration = steps * period;

  while (millis() - startTime < duration) {
    float t_ms = (float)(millis() - startTime);
    float phase = 2.0 * PI * t_ms / period;

    float foot_signal = sin(phase);
    float posLF = 90 + A_foot * foot_signal;
    float posRF = 90 + A_foot * foot_signal;

    float hip_signal =
        isForward ? sin(phase + PI / 2.0) : sin(phase - PI / 2.0);
    float posLH = 90 + A_hip * hip_signal;
    float posRH = 90 + A_hip * hip_signal;

    servos[0].write(posLH);
    currentPos[0] = posLH;
    servos[1].write(posRH);
    currentPos[1] = posRH;
    servos[2].write(posLF);
    currentPos[2] = posLF;
    servos[3].write(posRF);
    currentPos[3] = posRF;
    // 手臂保持原样
    delay(15);
    yield();
  }
}

// 🕺 动作：太空步 (dir: 1 为向左滑，-1 为向右滑)
void actionMoonwalk(int steps = 4, int period = 1200, int dir = 1) {
  int h = 25;
  unsigned long startTime = millis();
  unsigned long duration = steps * period;

  while (millis() - startTime < duration) {
    float t_ms = (float)(millis() - startTime);
    float phase = 2.0 * PI * t_ms / period;
    float phi = -dir * PI / 2.0;

    float phaseLF = phase + phi;
    float phaseRF = phase + (-60.0 * dir * PI / 180.0) + phi;

    float posLF = 90 + (h / 2 + 2) + h * sin(phaseLF);
    float posRF = 90 + (-h / 2 - 2) + h * sin(phaseRF);

    servos[2].write(posLF);
    currentPos[2] = posLF;
    servos[3].write(posRF);
    currentPos[3] = posRF;
    delay(15);
    yield();
  }
}

// 🌊 动作：全身电流舞 (右起左落)
void actionFullBodyWave(int cycles = 3, int T_period = 2000) {
  int A_arm = 45;
  int h = 35;
  for (int i = 0; i < 6; i++)
    osc[i].setParams(0, 0, 0, 1000); // 清零

  osc[5].setParams(A_arm, 0, PI / 2.0, T_period);       // 右手领跑
  osc[2].setParams(h, h / 2 + 2, 0, T_period);          // 左脚
  osc[3].setParams(h, -h / 2 - 2, -PI / 3.0, T_period); // 右脚
  osc[4].setParams(A_arm, 0, -PI, T_period);            // 左手收尾

  unsigned long start = millis();
  unsigned long totalDuration = T_period * cycles;
  while (millis() - start < totalDuration) {
    for (int i = 0; i < 4; i++)
      osc[i].refresh(i, false, false);
    osc[4].refresh(4, true, false); // 左手启用 Pop
    osc[5].refresh(5, true, true);  // 右手启用 Pop
    yield();
  }
  goHomeSmooth(1000);
}

// 👋 动作：单侧挥手告别
void actionWaveGoodbye(int steps = 3, int amplitude = 15, int tempo = 1000,
                       int armBias = 45, String style = "classic") {
  amplitude = constrain(adjustAmplitudeForStyle(style, amplitude), 8, 28);
  armBias = constrain(armBias, 25, 65);
  tempo = constrain(tempo, 600, 1600);
  float prepPos[6] = {90, 90, 90, 90, 90 + armBias, 90 + min(60, armBias + 15)};
  smoothMove(prepPos, 1200);
  osc[4].setParams(amplitude, armBias, 0, tempo);
  osc[5].setParams(0, min(60, armBias + 15), 0, tempo);
  playGesture(steps * tempo);
}

// 🤝 动作：双手打招呼
void actionDoubleGreet(int steps = 3, int amplitude = 15, int tempo = 1200,
                       int armBias = 15) {
  amplitude = constrain(amplitude, 8, 24);
  armBias = constrain(armBias, 5, 30);
  tempo = constrain(tempo, 700, 1800);
  float prepPos[6] = {90, 90, 90, 90, 90 + armBias, 90 - armBias};
  smoothMove(prepPos, 1000);
  osc[4].setParams(amplitude, armBias, 0, tempo);
  osc[5].setParams(amplitude, -armBias, PI, tempo);
  playGesture(steps * tempo);
}

// 🙌 动作：双手欢呼
void actionCheer(int steps = 8, int amplitude = 8, int tempo = 400,
                 String style = "bright") {
  amplitude =
      constrain(adjustAmplitudeForStyle(style, amplitude, -1, 2), 4, 16);
  tempo = constrain(tempo, 220, 800);
  int armOffset = style == "victory" ? 42 : 37;
  float prepPos[6] = {90, 90, 90, 90, 90 + armOffset, 90 - armOffset};
  smoothMove(prepPos, 800);
  osc[4].setParams(amplitude, armOffset, 0, tempo);
  osc[5].setParams(amplitude, -armOffset, PI, tempo);
  playGesture(steps * tempo);
}

// 🦵 动作：左/右侧抖腿
void actionShakeLegLeft(int duration = 3000) {
  goHomeSmooth(800);
  osc[0].setParams(22, 22, 0, 250);
  playGesture(duration);
}
void actionShakeLegRight(int duration = 3000) {
  goHomeSmooth(800);
  osc[1].setParams(22, -22, 0, 250);
  playGesture(duration);
}

// 💥 动作：左/右侧跺脚
void actionStompLeft(int duration = 3000) {
  goHomeSmooth(800);
  osc[2].setParams(15, -15, 0, 400);
  playGesture(duration);
}
void actionStompRight(int duration = 3000) {
  goHomeSmooth(800);
  osc[3].setParams(15, 15, 0, 400);
  playGesture(duration);
}

// 🔥 动作：英雄登场定格 (单臂170度安全版)
void actionHeroPose(int holdTime = 4000) {
  float posHero[6] = {90, 135, 90, 135, 170, 90};
  smoothMove(posHero, 600);
  delay(holdTime);
  goHomeSmooth(1500);
}

// 💤 动作：睡眠模式 (修正版)
void actionSleep(int duration = 12000) {
  // 1. 准备姿势：双臂下垂 60 度 (LA:30, RA:150)
  float prepPos[6] = {90, 90, 90, 90, 30, 150};
  smoothMove(prepPos, 2000);

  // 🌟 关键修正：为手臂引擎设置 Offset，但振幅(A)设为 0
  // 这样 playGesture 刷新时，手臂会锁定在 90 + Offset 的位置
  osc[4].setParams(0, -60, 0, 3000); // 左手：90 - 60 = 30
  osc[5].setParams(0, 60, 0, 3000);  // 右手：90 + 60 = 150

  // 2. 开启脚尖呼吸律动
  osc[2].setParams(10, -10, 0, 3000);
  osc[3].setParams(10, 10, 0, 3000);

  playGesture(duration); // 现在刷新全部 6 关节时，手臂会停在下方了
}

// 🌸 动作：安抚模式
void actionSoothe(int duration = 10000) {
  goHomeSmooth(1000);
  osc[4].setParams(10, 0, 0, 2500);
  osc[5].setParams(10, 0, PI, 2500);
  playGesture(duration);
}

// 动作：机械扭胯 (街舞律动)
void actionTwistHip(int cycles = 4, int moveTime = 250, int pauseTime = 150,
                    String style = "classic") {
  if (style == "tight") {
    moveTime = max(150, moveTime - 40);
    pauseTime = max(70, pauseTime - 30);
  } else if (style == "dramatic") {
    moveTime += 40;
    pauseTime += 20;
  }
  float posRight[6] = {90, 120, 90, 90, 90, 90};
  float posBothRight[6] = {120, 120, 90, 90, 90, 90};
  float posLeftLead[6] = {60, 120, 90, 90, 90, 90};
  float posBothLeft[6] = {60, 60, 90, 90, 90, 90};

  smoothMove(posRight, moveTime);
  delay(pauseTime);
  smoothMove(posBothRight, moveTime);
  delay(pauseTime);

  for (int i = 0; i < cycles; i++) {
    smoothMove(posLeftLead, moveTime);
    delay(pauseTime);
    smoothMove(posBothLeft, moveTime);
    delay(pauseTime);
    smoothMove(posLeftLead, moveTime);
    delay(pauseTime);
    smoothMove(posBothRight, moveTime);
    delay(pauseTime);
  }
  goHomeSmooth(moveTime * 2);
}

// ✨ 动作：慢速对称开合 (深蹲呼吸感)
void actionSymmetricHips(int cycles = 3, int moveTime = 1200,
                         int pauseTime = 500) {
  float posOpen[6] = {60, 120, 90, 90, 90, 90};
  float posClose[6] = {120, 60, 90, 90, 90, 90};

  for (int i = 0; i < cycles; i++) {
    smoothMove(posOpen, moveTime);
    delay(pauseTime);
    smoothMove(posClose, moveTime);
    delay(pauseTime);
  }
  goHomeSmooth(moveTime);
}

// 🙇 动作：点头鞠躬
void actionBow(int cycles = 2, int depth = 22, int moveTime = 520,
               int holdTime = 260) {
  depth = constrain(depth, 10, 32);
  moveTime = constrain(moveTime, 260, 900);
  holdTime = constrain(holdTime, 120, 1000);

  float neutralArms[6] = {90, 90, 90, 90, 72, 108};
  float bowPos[6] = {90 + depth,     90 - depth, 90 + depth / 3,
                     90 - depth / 3, 55,         125};

  smoothMove(neutralArms, max(400, moveTime - 80));
  for (int i = 0; i < cycles; i++) {
    smoothMove(bowPos, moveTime);
    delay(holdTime);
    smoothMove(neutralArms, moveTime);
    delay(max(120, holdTime / 2));
  }
  goHomeSmooth(moveTime + 200);
}

// 👐 动作：展开双臂欢迎
void actionOpenArms(int cycles = 3, int armSpread = 42, int tempo = 1200,
                    int sway = 8) {
  armSpread = constrain(armSpread, 20, 60);
  tempo = constrain(tempo, 700, 1800);
  sway = constrain(sway, 0, 16);

  float prepPos[6] = {90, 90, 90, 90, 90 + armSpread, 90 - armSpread};
  smoothMove(prepPos, 900);
  osc[0].setParams(sway, 0, 0, tempo);
  osc[1].setParams(sway, 0, PI, tempo);
  osc[4].setParams(max(4, sway), armSpread, 0, tempo);
  osc[5].setParams(max(4, sway), -armSpread, PI, tempo);
  playGesture(cycles * tempo);
  goHomeSmooth(900);
}

// 🥁 动作：原地踏步
void actionMarch(int steps = 6, int lift = 18, int tempo = 700,
                 int armSwing = 18) {
  steps = constrain(steps, 2, 12);
  lift = constrain(lift, 8, 26);
  tempo = constrain(tempo, 420, 1200);
  armSwing = constrain(armSwing, 0, 30);

  for (int i = 0; i < steps; i++) {
    float leftLift[6] = {
        90, 90, 90 + lift, 90 - lift / 3, 90 - armSwing, 90 + armSwing};
    float rightLift[6] = {
        90, 90, 90 - lift / 3, 90 - lift, 90 + armSwing, 90 - armSwing};
    smoothMove(leftLift, tempo / 2);
    smoothMove(rightLift, tempo / 2);
  }
  goHomeSmooth(600);
}

// 🎷 动作：左右摇摆律动
void actionLeanGroove(int cycles = 4, int lean = 18, int tempo = 850,
                      int armBias = 24) {
  cycles = constrain(cycles, 2, 8);
  lean = constrain(lean, 8, 28);
  tempo = constrain(tempo, 500, 1400);
  armBias = constrain(armBias, 8, 36);

  float leftPose[6] = {90 - lean,     90 - lean / 2, 90 - lean / 3,
                       90 + lean / 3, 90 + armBias,  90 - armBias / 2};
  float rightPose[6] = {90 + lean / 2, 90 + lean,        90 - lean / 3,
                        90 + lean / 3, 90 + armBias / 2, 90 - armBias};

  for (int i = 0; i < cycles; i++) {
    smoothMove(leftPose, tempo / 2);
    delay(tempo / 6);
    smoothMove(rightPose, tempo / 2);
    delay(tempo / 6);
  }
  goHomeSmooth(700);
}

// ✋ 动作：敬礼致意
void actionSalute(int cycles = 2, int armBias = 52, int holdTime = 350) {
  cycles = constrain(cycles, 1, 5);
  armBias = constrain(armBias, 36, 68);
  holdTime = constrain(holdTime, 120, 1000);
  float neutral[6] = {90, 90, 90, 90, 82, 98};
  float salutePose[6] = {90, 90, 90, 90, 90 - armBias / 3, 90 - armBias};
  smoothMove(neutral, 600);
  for (int i = 0; i < cycles; i++) {
    smoothMove(salutePose, 420);
    delay(holdTime);
    smoothMove(neutral, 360);
    delay(max(120, holdTime / 2));
  }
  goHomeSmooth(600);
}

// 🎁 动作：左侧展示
void actionPresentLeft(int cycles = 2, int armSpread = 42, int holdTime = 420) {
  cycles = constrain(cycles, 1, 5);
  armSpread = constrain(armSpread, 24, 62);
  holdTime = constrain(holdTime, 160, 1200);
  float pose[6] = {80, 100, 90, 90, 90 + armSpread, 76};
  for (int i = 0; i < cycles; i++) {
    smoothMove(pose, 520);
    delay(holdTime);
    goHomeSmooth(420);
    delay(max(120, holdTime / 2));
  }
}

// 🎁 动作：右侧展示
void actionPresentRight(int cycles = 2, int armSpread = 42,
                        int holdTime = 420) {
  cycles = constrain(cycles, 1, 5);
  armSpread = constrain(armSpread, 24, 62);
  holdTime = constrain(holdTime, 160, 1200);
  float pose[6] = {100, 80, 90, 90, 104, 90 - armSpread};
  for (int i = 0; i < cycles; i++) {
    smoothMove(pose, 520);
    delay(holdTime);
    goHomeSmooth(420);
    delay(max(120, holdTime / 2));
  }
}

// 🤷 动作：耸肩困惑
void actionShrug(int cycles = 4, int amplitude = 10, int tempo = 700) {
  cycles = constrain(cycles, 2, 8);
  amplitude = constrain(amplitude, 4, 16);
  tempo = constrain(tempo, 400, 1200);
  float prep[6] = {90, 90, 90, 90, 105, 75};
  smoothMove(prep, 500);
  osc[0].setParams(amplitude / 2, 0, 0, tempo);
  osc[1].setParams(amplitude / 2, 0, PI, tempo);
  osc[4].setParams(amplitude, 15, 0, tempo);
  osc[5].setParams(amplitude, -15, PI, tempo);
  playGesture(cycles * tempo);
  goHomeSmooth(600);
}

// 🪩 动作：迪斯科指向
void actionDiscoPoint(int cycles = 4, int tempo = 760, int armBias = 40,
                      int lean = 18) {
  cycles = constrain(cycles, 2, 8);
  tempo = constrain(tempo, 450, 1300);
  armBias = constrain(armBias, 22, 58);
  lean = constrain(lean, 8, 26);
  float leftPose[6] = {90 - lean, 90, 90, 90, 90 + armBias, 50};
  float rightPose[6] = {90, 90 + lean, 90, 90, 130, 90 - armBias};
  for (int i = 0; i < cycles; i++) {
    smoothMove(leftPose, tempo / 2);
    delay(tempo / 5);
    smoothMove(rightPose, tempo / 2);
    delay(tempo / 5);
  }
  goHomeSmooth(700);
}

// 🚶 动作：侧向交叉步
void actionCrossStep(int cycles = 4, int lean = 16, int tempo = 900) {
  cycles = constrain(cycles, 2, 8);
  lean = constrain(lean, 8, 24);
  tempo = constrain(tempo, 550, 1500);
  float leftCross[6] = {90 - lean,     90 + lean / 2, 90 - lean,
                        90 + lean / 2, 100,           80};
  float rightCross[6] = {90 + lean / 2, 90 - lean, 90 - lean / 2,
                         90 + lean,     80,        100};
  for (int i = 0; i < cycles; i++) {
    smoothMove(leftCross, tempo / 2);
    delay(tempo / 6);
    smoothMove(rightCross, tempo / 2);
    delay(tempo / 6);
  }
  goHomeSmooth(650);
}

// 🦶 动作：踮脚弹跳
void actionTiptoeBounce(int cycles = 6, int amplitude = 10, int tempo = 420) {
  cycles = constrain(cycles, 2, 12);
  amplitude = constrain(amplitude, 4, 16);
  tempo = constrain(tempo, 220, 800);
  float prep[6] = {90, 90, 82, 98, 96, 84};
  smoothMove(prep, 500);
  osc[2].setParams(amplitude, -amplitude / 2, 0, tempo);
  osc[3].setParams(amplitude, amplitude / 2, PI, tempo);
  osc[4].setParams(amplitude / 2, 6, PI / 2.0, tempo);
  osc[5].setParams(amplitude / 2, -6, -PI / 2.0, tempo);
  playGesture(cycles * tempo);
  goHomeSmooth(650);
}

// 🦸 动作：力量站姿
void actionPowerStance(int holdTime = 3200, int armSpread = 24, int lean = 16) {
  holdTime = constrain(holdTime, 1200, 7000);
  armSpread = constrain(armSpread, 10, 36);
  lean = constrain(lean, 8, 24);
  float pose[6] = {90 - lean,     90 + lean,      90 - lean / 2,
                   90 + lean / 2, 90 + armSpread, 90 - armSpread};
  smoothMove(pose, 700);
  delay(holdTime);
  goHomeSmooth(900);
}

// 🙈 动作：捂眼偷看
void actionPeekaboo(int cycles = 3, int armBias = 38, int tempo = 700) {
  cycles = constrain(cycles, 1, 6);
  armBias = constrain(armBias, 20, 50);
  tempo = constrain(tempo, 420, 1200);
  float hidePose[6] = {90, 90, 90, 90, 90 + armBias, 90 - armBias};
  float peekPose[6] = {90, 90, 90, 90, 102, 78};
  for (int i = 0; i < cycles; i++) {
    smoothMove(hidePose, tempo / 2);
    delay(tempo / 5);
    smoothMove(peekPose, tempo / 2);
    delay(tempo / 5);
  }
  goHomeSmooth(650);
}

// 🌬️ 动作：摇摆欢迎
void actionSwayWelcome(int cycles = 4, int armSpread = 36, int tempo = 1100,
                       int sway = 12) {
  cycles = constrain(cycles, 2, 8);
  armSpread = constrain(armSpread, 18, 56);
  tempo = constrain(tempo, 700, 1700);
  sway = constrain(sway, 4, 18);
  float prep[6] = {90, 90, 90, 90, 90 + armSpread, 90 - armSpread};
  smoothMove(prep, 700);
  osc[0].setParams(sway, 0, 0, tempo);
  osc[1].setParams(sway, 0, PI, tempo);
  osc[4].setParams(max(4, sway / 2), armSpread, PI / 4.0, tempo);
  osc[5].setParams(max(4, sway / 2), -armSpread, -PI / 4.0, tempo);
  playGesture(cycles * tempo);
  goHomeSmooth(700);
}

#endif
