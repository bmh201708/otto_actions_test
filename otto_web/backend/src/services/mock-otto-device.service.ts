import { Prisma } from "@prisma/client";
import type { PrismaClient, RobotStatus } from "@prisma/client";

import { normalizeActionRequest, VALID_ACTIONS } from "./otto-action-specs.service";
import { ensureRobotStatus, persistRobotStatus } from "./robot-status.store";

type Direction = "forward" | "backward" | "left" | "right";
export type SequenceExecutionStep = {
  label: string;
  actionKey: string;
  offsetMs: number;
  params?: Prisma.JsonValue | null;
};

export type VoiceDeviceStatus = {
  isListening: boolean;
  audioUploadState: "idle" | "recording" | "uploading" | "uploaded" | "failed";
  lastTranscriptPreview: string | null;
  activeVoiceSessionId: string | null;
};

const mockVoiceState: VoiceDeviceStatus = {
  isListening: false,
  audioUploadState: "idle",
  lastTranscriptPreview: null,
  activeVoiceSessionId: null
};

export interface OttoDeviceService {
  getStatus(): Promise<RobotStatus>;
  executeAction(actionKey: string, params?: Prisma.JsonValue): Promise<RobotStatus>;
  move(direction: Direction | string): Promise<RobotStatus>;
  speak(text: string): Promise<RobotStatus>;
  calibrate(): Promise<RobotStatus>;
  executeSequence(steps: SequenceExecutionStep[]): Promise<RobotStatus>;
  startListening(sessionId: string, uploadUrl: string): Promise<VoiceDeviceStatus>;
  stopListening(): Promise<VoiceDeviceStatus>;
  getVoiceStatus(): Promise<VoiceDeviceStatus>;
}

export class MockOttoDeviceService implements OttoDeviceService {
  constructor(private readonly prisma: PrismaClient) {}

  async getStatus() {
    return ensureRobotStatus(this.prisma);
  }

  async executeAction(actionKey: string, params?: Prisma.JsonValue) {
    if (!VALID_ACTIONS.has(actionKey)) {
      throw new Error("Unsupported action key");
    }

    const normalized = normalizeActionRequest(actionKey, params ?? undefined);
    return this.bumpStatus(actionKey, normalized.params as unknown as Prisma.JsonValue);
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

  async executeSequence(steps: SequenceExecutionStep[]) {
    return this.bumpStatus("execute-sequence", {
      stepCount: steps.length,
      steps
    });
  }

  async startListening(sessionId: string) {
    mockVoiceState.isListening = true;
    mockVoiceState.audioUploadState = "recording";
    mockVoiceState.activeVoiceSessionId = sessionId;
    mockVoiceState.lastTranscriptPreview = null;
    return { ...mockVoiceState };
  }

  async stopListening() {
    mockVoiceState.isListening = false;
    mockVoiceState.audioUploadState = "uploaded";
    return { ...mockVoiceState };
  }

  async getVoiceStatus() {
    return { ...mockVoiceState };
  }

  private async ensureStatus() {
    return ensureRobotStatus(this.prisma);
  }

  private async bumpStatus(actionKey: string, params?: Prisma.JsonValue) {
    const current = await this.ensureStatus();
    const batteryPercent = Math.max(22, current.batteryPercent - 1);
    const distanceCm = Number((Math.random() * 12 + 2).toFixed(1));
    const memoryPercent = Math.min(88, current.memoryPercent + 1);
    const coreTempC = Math.min(55, current.coreTempC + (actionKey === "calibrate" ? 2 : 1));

    return persistRobotStatus(
      this.prisma,
      {
        isBusy: false,
        currentAction: actionKey,
        batteryPercent,
        distanceCm,
        memoryPercent,
        coreTempC,
        signalStrength: batteryPercent < 35 ? "Weak" : "Stable",
        lastTelemetryAt: new Date()
      },
      {
        actionKey,
        params
      }
    );
  }
}
