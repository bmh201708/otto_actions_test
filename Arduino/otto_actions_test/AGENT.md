# AGENT.md

## 1. Project Purpose

This repository contains an Arduino-style ESP32 sketch for an Otto robot.

The robot behavior is:

1. Use an ultrasonic sensor to detect a nearby person.
2. Enter an interactive "theater" sequence after a distance trigger.
3. Play servo-based body motions and online Baidu TTS speech in parallel.
4. Wait for a serial input of `1`, `2`, or `3` to choose one of three endings.

This is not a generic Otto library project. It is a concrete single-purpose performance script for one ESP32-based Otto robot build.

## 2. Repository Layout

- `otto_actions_test.ino`
  - Main program entry.
  - Handles Wi-Fi, Baidu TTS token acquisition, I2S audio output, ultrasonic trigger, theater flow control, and serial branch selection.
- `ottoactions.h`
  - Local motion library for this project.
  - Defines servo pins, current position tracking, a lightweight oscillator engine, smooth transitions, and all robot action functions.
- `Oscillator.h`
- `Oscillator.cpp`
  - Legacy oscillator implementation kept in the repository.
  - These files are not referenced by the main sketch directly.
  - They should be treated as legacy code and a possible maintenance risk because `ottoactions.h` also defines a different `Oscillator` class with the same name.

## 3. Hardware Mapping

### 3.1 Servo Pins

Defined in `ottoactions.h`:

- Left hip: GPIO `13`
- Right hip: GPIO `12`
- Left foot: GPIO `14`
- Right foot: GPIO `27`
- Left arm: GPIO `26`
- Right arm: GPIO `25`

The code assumes exactly 6 servos:

- Index `0`: left hip
- Index `1`: right hip
- Index `2`: left foot
- Index `3`: right foot
- Index `4`: left arm
- Index `5`: right arm

### 3.2 Ultrasonic Sensor

Defined in `otto_actions_test.ino`:

- `PIN_TRIG = 32`
- `PIN_ECHO = 33`

Trigger condition in `loop()`:

- measured distance must be greater than `2.0 cm`
- measured distance must be less than `15.0 cm`

### 3.3 Audio Output (I2S Amplifier)

Defined in `otto_actions_test.ino`:

- `AMP_LRC = 22`
- `AMP_DIN = 15`
- `AMP_BCLK = 2`
- output port: `I2S_NUM_1`

The amplifier is configured as:

- sample rate: `8000`
- sample width: `16-bit`
- stereo output format

Mono TTS PCM is duplicated into left and right channels before playback.

### 3.4 Microphone Pins

Declared but currently unused:

- `MIC_WS = 21`
- `MIC_SD = 35`
- `MIC_SCK = 19`
- mic port: `I2S_NUM_0`

Important: the current project does not initialize microphone capture and does not implement speech recognition. These pin definitions are placeholders only in the current codebase.

## 4. Software Dependencies

The sketch depends on the Arduino ESP32 environment and these libraries:

- `Arduino.h`
- `WiFi.h`
- `HTTPClient.h`
- `ArduinoJson.h`
- `driver/i2s.h`
- `ESP32Servo.h`

Operational expectation:

- The project is intended to be built with the Arduino framework for ESP32.
- There is no `platformio.ini`, no `library.properties`, and no board config file in the repository.
- Build and upload settings are therefore expected to be configured in the Arduino IDE or equivalent ESP32 Arduino tooling.

## 5. Runtime Architecture

### 5.1 Setup Phase

`setup()` performs the following in order:

1. Start serial at `115200`.
2. Configure ultrasonic pins.
3. Call `initOtto()` to attach all 6 servos and move them to `90` degrees.
4. Connect to Wi-Fi using hard-coded SSID and password.
5. Configure the I2S amplifier output.
6. Request a Baidu OAuth access token using hard-coded `AK` and `SK`.
7. Start a dedicated FreeRTOS task `ttsTask` pinned to core `0`.

### 5.2 Main Loop

`loop()` continuously:

1. Skips all trigger logic while `isBusy == true`.
2. Sends one ultrasonic pulse.
3. Measures echo width with `pulseIn(..., 30000)`.
4. Converts the result to distance in centimeters.
5. If distance is between `2` and `15` cm, calls `runInteractiveTheater()`.

### 5.3 Speech Model

Speech is handled asynchronously:

- `speakAsync(text)` only writes to a global `speechQueue` string.
- `ttsTask()` polls the queue.
- `speakBlocking(text)` performs the actual Baidu TTS HTTP request and streams audio to I2S.

Important constraints:

- The queue is only a single global string, not a real FIFO.
- A new `speakAsync()` call can overwrite a pending text if not consumed yet.
- `endPhase()` waits until speech has fully finished before continuing.

### 5.4 Theater Structure

`runInteractiveTheater()` is the main show controller:

1. Set `isBusy = true`.
2. Run common stage 1: greeting.
3. Run common stage 2: sensing.
4. Flush serial input buffer.
5. Block until serial receives `1`, `2`, or `3`.
6. Execute one of three branching flows.
7. Set `isBusy = false`.

This means the robot will stop and wait indefinitely for a serial choice after the first two common stages.

## 6. Motion System

### 6.1 Core Design

The motion layer is implemented locally in `ottoactions.h`, not through a third-party Otto action library.

It uses:

- `Servo servos[6]`
- `float currentPos[6]`
- `Oscillator osc[6]`

`currentPos` is important. It tracks the robot's believed physical angle for each joint so that the next action can transition smoothly from the current pose instead of jumping back to a fixed default.

### 6.2 Transition Utilities

Main helpers:

- `initOtto()`
- `smoothMove(float targets[], int moveTime)`
- `goHomeSmooth(int duration = 1000)`
- `playGesture(int duration)`

Behavior notes:

- `smoothMove()` linearly interpolates all six joints.
- `goHomeSmooth()` returns to neutral `{90, 90, 90, 90, 90, 90}`.
- `playGesture()` repeatedly refreshes all oscillators for a fixed duration.

### 6.3 End-of-Phase Reset

`endPhase()` is a hard cleanup step after each stage:

1. Wait for speech playback to finish.
2. Zero all oscillator amplitudes and offsets.
3. Force a return to home pose with `goHomeSmooth(800)`.
4. Delay briefly.

This is meant to prevent residual oscillation from leaking into the next stage.

## 7. Action Inventory

Current project-defined action functions: `15`

### 7.1 Locomotion and Body Motion

- `actionWalk`
  - Walk forward or backward by changing hip and foot phase relationships.
- `actionMoonwalk`
  - Side-sliding moonwalk style foot motion.
- `actionFullBodyWave`
  - Whole-body wave with both arms and both feet coordinated.
- `actionTwistHip`
  - Mechanical hip twist sequence using fixed target poses.
- `actionSymmetricHips`
  - Slow symmetric open-close hip movement.

### 7.2 Greeting and Expression

- `actionWaveGoodbye`
  - One-sided wave after moving to a prepared arm pose.
- `actionDoubleGreet`
  - Two-arm greeting motion.
- `actionCheer`
  - Fast celebratory dual-arm motion.
- `actionHeroPose`
  - Static heroic pose with one arm raised.

### 7.3 Leg and Foot Emphasis

- `actionShakeLegLeft`
- `actionShakeLegRight`
  - Quick oscillation of one hip side.
- `actionStompLeft`
- `actionStompRight`
  - Repetitive left or right foot stomp.

### 7.4 Calm / Rest Motions

- `actionSleep`
  - Arms lowered, feet breathing slowly.
- `actionSoothe`
  - Gentle arm sway.

## 8. Interactive Story Flows

The robot has three branch endings after the first two shared stages.

### 8.1 Common Stages

- Stage 1:
  - Speech: greeting and invitation.
  - Motion: `actionDoubleGreet(2)` then `actionWalk(2, 1200, true)`
- Stage 2:
  - Speech: sensing field.
  - Motion: `actionShakeLegRight(2500)`

### 8.2 Flow 1: "运势大吉 / 早八人"

- `actionHeroPose(3000)`
- `actionFullBodyWave(2, 2000)`
- `actionStompLeft(2000)`
- `actionCheer(5)`
- `actionWaveGoodbye(3)`

### 8.3 Flow 2: "建议休息 / 关机散热"

- `actionSleep(4000)`
- `actionSymmetricHips(2, 1200, 500)`
- `actionSoothe(4000)`
- `actionWaveGoodbye(3)`

### 8.4 Flow 3: "人际偶遇 / Crush 出现"

- `actionMoonwalk(3, 1200, 1)`
- `actionTwistHip(2, 250, 150)`
- `actionCheer(5)`
- `actionWalk(2, 1000, false)`
- `goHomeSmooth(500)`
- `actionStompRight(2000)`
- `actionWaveGoodbye(3)`

## 9. Credentials and External Services

The current sketch includes hard-coded secrets:

- Wi-Fi SSID
- Wi-Fi password
- Baidu `AK`
- Baidu `SK`

These are directly embedded in source code.

Maintenance guidance:

- Do not commit real production credentials to a public repository.
- If this project is going to be shared, move secrets to a local config header that is excluded from version control.
- If the robot stops speaking, first check Wi-Fi status and Baidu token acquisition.

## 10. Known Risks and Maintenance Traps

### 10.1 Duplicate `Oscillator` Definitions

There are two different oscillator implementations in the repository:

- one local class defined in `ottoactions.h`
- one legacy class split across `Oscillator.h/.cpp`

This is a structural risk and should be cleaned up before significant refactoring.

### 10.2 Blocking Serial Branch Selection

After trigger and the first two stages, the program blocks forever until serial input is received.

Implication:

- If no host computer or serial sender is connected, the robot will stall in the middle of the show.

### 10.3 Network-Dependent Speech

Speech depends on:

- working Wi-Fi
- valid Baidu credentials
- successful OAuth token acquisition
- reachable Baidu TTS endpoint

If networking fails, motion still exists but spoken interaction will be degraded or silent.

### 10.4 No Real Microphone Pipeline Yet

Despite the defined mic pins, there is currently:

- no mic driver setup
- no recording buffer
- no ASR request path
- no local wake word logic

Do not assume this is a voice-input robot yet. It is currently a trigger-plus-serial-choice robot with online speech output.

### 10.5 Hardware Validation Is Required

This repository has no automated tests.

Any meaningful change to:

- servo timing
- servo angle ranges
- power behavior
- Wi-Fi / HTTP / I2S behavior

must be validated on real ESP32 hardware.

## 11. Guidance For Future Agents

When modifying this project, keep these rules:

1. Treat `otto_actions_test.ino` as the orchestration layer.
2. Treat `ottoactions.h` as the actual robot behavior library.
3. Avoid changing servo pin assignments unless the hardware wiring also changes.
4. Preserve `currentPos` updates whenever adding new motion code; otherwise transitions will become jerky.
5. Preserve or improve `endPhase()` cleanup when adding new stages.
6. Be careful with servo angle limits. Some motions already use large arm angles such as `170`.
7. If adding queue-like speech behavior, replace `speechQueue` with a real thread-safe queue instead of repeated string overwrite.
8. If removing legacy files, validate that the Arduino build still succeeds after cleanup.
9. If making the robot autonomous, replace serial branch selection with onboard input or a timeout-based default branch.

## 12. Recommended Near-Term Improvements

The highest-value improvements for this codebase are:

1. Separate secrets from source code.
2. Remove or rename the legacy `Oscillator.h/.cpp` implementation.
3. Add a non-blocking fallback if serial input is absent.
4. Decide whether microphone input is actually required; if not, remove dead declarations.
5. Split `ottoactions.h` into `.h + .cpp` for cleaner structure once the behavior is stable.

## 13. Current State Summary

This project is already a usable ESP32 Otto performance script with:

- ultrasonic trigger
- 6-servo action system
- 15 defined action functions
- 3 story branches
- online Chinese TTS output via Baidu

But it is still closer to a lab prototype or demo build than a hardened embedded product. The main reasons are hard-coded secrets, blocking serial flow control, unused mic declarations, and duplicate oscillator implementations.
