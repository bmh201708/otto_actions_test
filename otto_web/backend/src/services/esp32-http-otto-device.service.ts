import { Prisma } from "@prisma/client";
import type { PrismaClient, RobotStatus } from "@prisma/client";

import { env } from "../config/env";
import { normalizeActionRequest, VALID_ACTIONS } from "./otto-action-specs.service";
import type { OttoDeviceService, SequenceExecutionStep, VoiceDeviceStatus } from "./mock-otto-device.service";
import { ensureRobotStatus, markRobotOffline, persistRobotStatus, signalStrengthFromRssi } from "./robot-status.store";

type DeviceStatusPayload = {
  isOnline?: boolean;
  isBusy?: boolean;
  currentAction?: string | null;
  distanceCm?: number;
  signalStrength?: string;
  lastTelemetryAt?: string | number | null;
  firmwareVersion?: string;
  memoryPercent?: number;
  batteryPercent?: number;
  coreTempC?: number;
  lastError?: string | null;
  wifiRssi?: number | null;
  isListening?: boolean;
  audioUploadState?: "idle" | "recording" | "uploading" | "uploaded" | "failed";
  lastTranscriptPreview?: string | null;
  activeVoiceSessionId?: string | null;
};

type DeviceCommandResponse = {
  ok: boolean;
  accepted?: boolean;
  commandId?: string;
  status?: DeviceStatusPayload;
  error?: string;
};

type DeviceStatusResponse = {
  ok: boolean;
  status?: DeviceStatusPayload;
  error?: string;
};

export class Esp32HttpOttoDeviceService implements OttoDeviceService {
  constructor(private readonly prisma: PrismaClient) {}

  async getStatus() {
    const current = await ensureRobotStatus(this.prisma);

    try {
      const payload = await this.fetchJson<DeviceStatusResponse>("/status");
      if (!payload.ok || !payload.status) {
        throw new Error(payload.error ?? "Invalid device status response");
      }

      return this.persistFromDeviceStatus(payload.status, current.currentAction, undefined);
    } catch (error) {
      await markRobotOffline(this.prisma, this.toErrorMessage(error));
      throw error;
    }
  }

  async executeAction(actionKey: string, params?: Prisma.JsonValue) {
    if (!VALID_ACTIONS.has(actionKey)) {
      throw new Error("Unsupported action key");
    }

    const normalized = normalizeActionRequest(actionKey, params ?? undefined);
    return this.sendCommand("/commands/action", {
      actionKey,
      params: normalized.params
    });
  }

  async move(direction: string) {
    return this.sendCommand("/commands/move", { direction });
  }

  async speak(text: string) {
    return this.sendCommand("/commands/speak", { text });
  }

  async calibrate() {
    return this.sendCommand("/commands/calibrate", { mode: "full" });
  }

  async executeSequence(steps: SequenceExecutionStep[]) {
    return this.sendCommand("/commands/sequence", { steps });
  }

  async executeTheater(choice: "1" | "2" | "3") {
    return this.sendCommand("/commands/theater", { choice });
  }

  async startListening(sessionId: string, uploadUrl: string) {
    const payload = await this.fetchJson<DeviceCommandResponse>("/commands/listen/start", {
      method: "POST",
      body: JSON.stringify({ sessionId, uploadUrl })
    });

    if (!payload.ok || !payload.accepted) {
      throw new Error(payload.error ?? "Device rejected listen/start");
    }

    return this.toVoiceStatus(payload.status ?? {});
  }

  async stopListening() {
    const payload = await this.fetchJson<DeviceCommandResponse>("/commands/listen/stop", {
      method: "POST",
      body: JSON.stringify({})
    });

    if (!payload.ok || !payload.accepted) {
      throw new Error(payload.error ?? "Device rejected listen/stop");
    }

    return this.toVoiceStatus(payload.status ?? {});
  }

  async getVoiceStatus() {
    const payload = await this.fetchJson<DeviceStatusResponse>("/status");
    if (!payload.ok || !payload.status) {
      throw new Error(payload.error ?? "Invalid device voice status response");
    }

    return this.toVoiceStatus(payload.status);
  }

  private async sendCommand(path: string, body: Record<string, unknown>) {
    const current = await ensureRobotStatus(this.prisma);

    try {
      const payload = await this.fetchJson<DeviceCommandResponse>(path, {
        method: "POST",
        body: JSON.stringify(body)
      });

      if (!payload.ok || !payload.accepted) {
        throw new Error(payload.error ?? "Device rejected command");
      }

      return this.persistFromDeviceStatus(payload.status ?? {}, current.currentAction, body as Prisma.JsonValue);
    } catch (error) {
      await markRobotOffline(this.prisma, this.toErrorMessage(error));
      throw error;
    }
  }

  private async persistFromDeviceStatus(
    status: DeviceStatusPayload,
    fallbackAction: string | null,
    params?: Prisma.JsonValue
  ): Promise<RobotStatus> {
    const signalStrength = status.signalStrength ?? signalStrengthFromRssi(status.wifiRssi ?? null);
    const currentAction = status.currentAction ?? fallbackAction ?? null;
    const lastTelemetryAt = this.toTelemetryDate(status.lastTelemetryAt);

    return persistRobotStatus(
      this.prisma,
      {
        isOnline: status.isOnline ?? true,
        isBusy: status.isBusy ?? false,
        batteryPercent: this.clampInt(status.batteryPercent, 0, 100, 84),
        signalStrength,
        distanceCm: this.clampNumber(status.distanceCm, 0, 999, 0),
        currentAction,
        coreTempC: this.clampInt(status.coreTempC, 0, 120, 42),
        memoryPercent: this.clampInt(status.memoryPercent, 0, 100, 12),
        firmwareVersion: status.firmwareVersion ?? "V.4.2.8",
        lastTelemetryAt
      },
      params && currentAction
        ? {
            actionKey: currentAction,
            params
          }
        : undefined
    );
  }

  private async fetchJson<T>(path: string, init?: RequestInit) {
    const baseUrl = env.OTTO_DEVICE_BASE_URL;
    if (!baseUrl) {
      throw new Error("OTTO_DEVICE_BASE_URL is not configured");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.OTTO_DEVICE_TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "X-Otto-Token": env.OTTO_DEVICE_TOKEN || "",
          ...(init?.headers ?? {})
        }
      });

      const body = (await response.json().catch(() => ({ ok: false, error: "Invalid JSON from device" }))) as T & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? `Device request failed with status ${response.status}`);
      }

      return body;
    } finally {
      clearTimeout(timeout);
    }
  }

  private toTelemetryDate(value?: string | number | null) {
    if (typeof value === "string") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.valueOf())) {
        return parsed;
      }
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return new Date(Date.now() - Math.max(0, value));
    }

    return new Date();
  }

  private clampInt(value: unknown, minimum: number, maximum: number, fallback: number) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return fallback;
    }

    return Math.round(Math.min(maximum, Math.max(minimum, value)));
  }

  private clampNumber(value: unknown, minimum: number, maximum: number, fallback: number) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return fallback;
    }

    return Math.min(maximum, Math.max(minimum, value));
  }

  private toErrorMessage(error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      return "Robot device request timed out";
    }

    return error instanceof Error ? error.message : "Unknown device error";
  }

  private toVoiceStatus(status: DeviceStatusPayload): VoiceDeviceStatus {
    return {
      isListening: status.isListening ?? false,
      audioUploadState: status.audioUploadState ?? "idle",
      lastTranscriptPreview: status.lastTranscriptPreview ?? null,
      activeVoiceSessionId: status.activeVoiceSessionId ?? null
    };
  }
}
