import { Prisma } from "@prisma/client";
import type { PrismaClient, RobotStatus } from "@prisma/client";

type Direction = "forward" | "backward" | "left" | "right";

export interface OttoDeviceService {
  getStatus(): Promise<RobotStatus>;
  executeAction(actionKey: string, params?: Prisma.JsonValue): Promise<RobotStatus>;
  move(direction: Direction | string): Promise<RobotStatus>;
  speak(text: string): Promise<RobotStatus>;
  calibrate(): Promise<RobotStatus>;
  executeSequence(sequenceId: string): Promise<RobotStatus>;
}

export const VALID_ACTIONS = new Set([
  "actionDoubleGreet",
  "actionFullBodyWave",
  "actionWaveGoodbye",
  "actionTwistHip",
  "actionCheer",
  "actionSleep",
  "actionHeroPose"
]);

export class MockOttoDeviceService implements OttoDeviceService {
  constructor(private readonly prisma: PrismaClient) {}

  async getStatus() {
    return this.ensureStatus();
  }

  async executeAction(actionKey: string, params?: Prisma.JsonValue) {
    if (!VALID_ACTIONS.has(actionKey)) {
      throw new Error("Unsupported action key");
    }

    return this.bumpStatus(actionKey, params);
  }

  async move(direction: string) {
    return this.bumpStatus(`move:${direction}`, { direction });
  }

  async speak(text: string) {
    return this.bumpStatus("speak", { text });
  }

  async calibrate() {
    return this.bumpStatus("calibrate", { mode: "full" });
  }

  async executeSequence(sequenceId: string) {
    return this.bumpStatus("execute-sequence", { sequenceId });
  }

  private async ensureStatus() {
    const existing = await this.prisma.robotStatus.findFirst({
      orderBy: { createdAt: "asc" }
    });

    if (existing) {
      return existing;
    }

    return this.prisma.robotStatus.create({
      data: {
        isOnline: true,
        isBusy: false,
        batteryPercent: 84,
        signalStrength: "Stable",
        distanceCm: 8.6,
        currentAction: "idle",
        coreTempC: 42,
        memoryPercent: 12,
        firmwareVersion: "V.4.2.8"
      }
    });
  }

  private async bumpStatus(actionKey: string, params?: Prisma.JsonValue) {
    const current = await this.ensureStatus();
    const batteryPercent = Math.max(22, current.batteryPercent - 1);
    const distanceCm = Number((Math.random() * 12 + 2).toFixed(1));
    const memoryPercent = Math.min(88, current.memoryPercent + 1);
    const coreTempC = Math.min(55, current.coreTempC + (actionKey === "calibrate" ? 2 : 1));

    const updated = await this.prisma.robotStatus.update({
      where: { id: current.id },
      data: {
        isBusy: false,
        currentAction: actionKey,
        batteryPercent,
        distanceCm,
        memoryPercent,
        coreTempC,
        signalStrength: batteryPercent < 35 ? "Weak" : "Stable",
        lastTelemetryAt: new Date()
      }
    });

    await this.prisma.robotActionLog.create({
      data: {
        actionKey,
        params: this.toNullableJsonInput(params),
        statusSnapshot: JSON.parse(JSON.stringify(updated)) as Prisma.InputJsonValue
      }
    });

    return updated;
  }

  private toNullableJsonInput(value?: Prisma.JsonValue | null) {
    if (value === undefined) return undefined;
    if (value === null) return Prisma.JsonNull;
    return value as Prisma.InputJsonValue;
  }
}
