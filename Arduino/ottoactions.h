#ifndef OTTO_ACTIONS_H
#define OTTO_ACTIONS_H

#include <ESP32Servo.h>

// ==========================================
// 1. 硬件引脚与全局变量定义
// ==========================================
const int PIN_LH = 13; const int PIN_RH = 12; // 0, 1: 胯部
const int PIN_LF = 14; const int PIN_RF = 27; // 2, 3: 脚部
const int PIN_LA = 26; const int PIN_RA = 25; // 4, 5: 手臂

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
      _A = A; _O = O; _phase0 = Ph; _T = T;
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
  ESP32PWM::allocateTimer(0); ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2); ESP32PWM::allocateTimer(3);
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
  for (int i = 0; i < 6; i++) startPos[i] = currentPos[i];
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
    for (int i = 0; i < 6; i++) osc[i].refresh(i);
    yield();
  }
}


// ==========================================
// 4. 欧神动作库 (Otto Actions)
// ==========================================

// 🚀 动作：前进 / 后退
void actionWalk(int steps = 4, int period = 1500, bool isForward = true) {
  int A_hip = 20; int A_foot = 30;
  unsigned long startTime = millis();
  unsigned long duration = steps * period;

  while (millis() - startTime < duration) {
    float t_ms = (float)(millis() - startTime);
    float phase = 2.0 * PI * t_ms / period;

    float foot_signal = sin(phase);
    float posLF = 90 + A_foot * foot_signal;
    float posRF = 90 + A_foot * foot_signal;

    float hip_signal = isForward ? sin(phase + PI/2.0) : sin(phase - PI/2.0);
    float posLH = 90 + A_hip * hip_signal;
    float posRH = 90 + A_hip * hip_signal;

    servos[0].write(posLH); currentPos[0] = posLH;
    servos[1].write(posRH); currentPos[1] = posRH;
    servos[2].write(posLF); currentPos[2] = posLF;
    servos[3].write(posRF); currentPos[3] = posRF;
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

    float posLF = 90 + (h/2 + 2) + h * sin(phaseLF);
    float posRF = 90 + (-h/2 - 2) + h * sin(phaseRF);

    servos[2].write(posLF); currentPos[2] = posLF;
    servos[3].write(posRF); currentPos[3] = posRF;
    delay(15);
    yield();
  }
}

// 🌊 动作：全身电流舞 (右起左落)
void actionFullBodyWave(int cycles = 3, int T_period = 2000) {
  int A_arm = 45; int h = 35;
  for(int i=0; i<6; i++) osc[i].setParams(0,0,0,1000); // 清零
  
  osc[5].setParams(A_arm, 0, PI/2.0, T_period); // 右手领跑
  osc[2].setParams(h, h/2 + 2, 0, T_period);    // 左脚
  osc[3].setParams(h, -h/2 - 2, -PI/3.0, T_period); // 右脚
  osc[4].setParams(A_arm, 0, -PI, T_period);    // 左手收尾

  unsigned long start = millis();
  unsigned long totalDuration = T_period * cycles;
  while (millis() - start < totalDuration) {
    for (int i = 0; i < 4; i++) osc[i].refresh(i, false, false);
    osc[4].refresh(4, true, false); // 左手启用 Pop
    osc[5].refresh(5, true, true);  // 右手启用 Pop
    yield();
  }
  goHomeSmooth(1000);
}

// 👋 动作：单侧挥手告别
void actionWaveGoodbye(int steps = 3) {
  float prepPos[6] = {90, 90, 90, 90, 135, 150};
  smoothMove(prepPos, 1200);
  osc[4].setParams(15, 45, 0, 1000);
  osc[5].setParams(0, 60, 0, 1000);
  playGesture(steps * 1000);
}

// 🤝 动作：双手打招呼
void actionDoubleGreet(int steps = 3) {
  float prepPos[6] = {90, 90, 90, 90, 105, 75};
  smoothMove(prepPos, 1000);
  osc[4].setParams(15, 15, 0, 1200);
  osc[5].setParams(15, -15, PI, 1200);
  playGesture(steps * 1200);
}

// 🙌 动作：双手欢呼
void actionCheer(int steps = 8) {
  float prepPos[6] = {90, 90, 90, 90, 127, 53};
  smoothMove(prepPos, 800);
  osc[4].setParams(8, 37, 0, 400);
  osc[5].setParams(8, -37, PI, 400);
  playGesture(steps * 400);
}

// 🦵 动作：左/右侧抖腿
void actionShakeLegLeft(int duration = 3000) { goHomeSmooth(800); osc[0].setParams(22, 22, 0, 250); playGesture(duration); }
void actionShakeLegRight(int duration = 3000) { goHomeSmooth(800); osc[1].setParams(22, -22, 0, 250); playGesture(duration); }

// 💥 动作：左/右侧跺脚
void actionStompLeft(int duration = 3000) { goHomeSmooth(800); osc[2].setParams(15, -15, 0, 400); playGesture(duration); }
void actionStompRight(int duration = 3000) { goHomeSmooth(800); osc[3].setParams(15, 15, 0, 400); playGesture(duration); }

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

// ⚡ 动作：机械扭胯 (街舞律动)
void actionTwistHip(int cycles = 4, int moveTime = 250, int pauseTime = 150) {
  float posRight[6]    = {90, 120, 90, 90, 90, 90};
  float posBothRight[6]= {120, 120, 90, 90, 90, 90};
  float posLeftLead[6] = {60, 120, 90, 90, 90, 90};
  float posBothLeft[6] = {60, 60, 90, 90, 90, 90};

  smoothMove(posRight, moveTime); delay(pauseTime);
  smoothMove(posBothRight, moveTime); delay(pauseTime);

  for (int i = 0; i < cycles; i++) {
    smoothMove(posLeftLead, moveTime); delay(pauseTime);
    smoothMove(posBothLeft, moveTime); delay(pauseTime);
    smoothMove(posLeftLead, moveTime); delay(pauseTime);
    smoothMove(posBothRight, moveTime); delay(pauseTime);
  }
  goHomeSmooth(moveTime * 2);
}

// ✨ 动作：慢速对称开合 (深蹲呼吸感)
void actionSymmetricHips(int cycles = 3, int moveTime = 1200, int pauseTime = 500) {
  float posOpen[6]  = {60, 120, 90, 90, 90, 90};
  float posClose[6] = {120, 60, 90, 90, 90, 90};

  for (int i = 0; i < cycles; i++) {
    smoothMove(posOpen, moveTime); delay(pauseTime);
    smoothMove(posClose, moveTime); delay(pauseTime);
  }
  goHomeSmooth(moveTime);
}

#endif
