import { Prisma } from "@prisma/client";
import type { PrismaClient, RobotStatus } from "@prisma/client";

type RobotStatusSnapshot = {
  isOnline: boolean;
  isBusy: boolean;
  batteryPercent: number;
  signalStrength: string;
  distanceCm: number;
  currentAction: string | null;
  coreTempC: number;
  memoryPercent: number;
  firmwareVersion: string;
  lastTelemetryAt: Date;
};

type RobotLogInput = {
  actionKey: string;
  params?: Prisma.JsonValue | null;
};

const DEFAULT_STATUS: RobotStatusSnapshot = {
  isOnline: true,
  isBusy: false,
  batteryPercent: 84,
  signalStrength: "Stable",
  distanceCm: 8.6,
  currentAction: "idle",
  coreTempC: 42,
  memoryPercent: 12,
  firmwareVersion: "V.4.2.8",
  lastTelemetryAt: new Date()
};

export async function ensureRobotStatus(prisma: PrismaClient) {
  const existing = await prisma.robotStatus.findFirst({
    orderBy: { createdAt: "asc" }
  });

  if (existing) {
    return existing;
  }

  return prisma.robotStatus.create({
    data: DEFAULT_STATUS
  });
}

export async function persistRobotStatus(
  prisma: PrismaClient,
  snapshot: Partial<RobotStatusSnapshot>,
  log?: RobotLogInput
) {
  const current = await ensureRobotStatus(prisma);
  const merged: RobotStatusSnapshot = {
    isOnline: snapshot.isOnline ?? current.isOnline,
    isBusy: snapshot.isBusy ?? current.isBusy,
    batteryPercent: snapshot.batteryPercent ?? current.batteryPercent,
    signalStrength: snapshot.signalStrength ?? current.signalStrength,
    distanceCm: snapshot.distanceCm ?? current.distanceCm,
    currentAction: snapshot.currentAction ?? current.currentAction,
    coreTempC: snapshot.coreTempC ?? current.coreTempC,
    memoryPercent: snapshot.memoryPercent ?? current.memoryPercent,
    firmwareVersion: snapshot.firmwareVersion ?? current.firmwareVersion,
    lastTelemetryAt: snapshot.lastTelemetryAt ?? new Date()
  };

  const updated = await prisma.robotStatus.update({
    where: { id: current.id },
    data: merged
  });

  if (log) {
    await prisma.robotActionLog.create({
      data: {
        actionKey: log.actionKey,
        params: toNullableJsonInput(log.params),
        statusSnapshot: JSON.parse(JSON.stringify(updated)) as Prisma.InputJsonValue
      }
    });
  }

  return updated;
}

export async function markRobotOffline(prisma: PrismaClient, reason: string) {
  return persistRobotStatus(prisma, {
    isOnline: false,
    isBusy: false,
    currentAction: `offline:${reason}`,
    signalStrength: "Offline",
    lastTelemetryAt: new Date()
  });
}

export function signalStrengthFromRssi(rssi?: number | null) {
  if (rssi === null || rssi === undefined) {
    return "Unknown";
  }

  if (rssi >= -60) return "Excellent";
  if (rssi >= -70) return "Stable";
  if (rssi >= -80) return "Weak";
  return "Poor";
}

export function toRobotStatusJson(status: RobotStatus) {
  return {
    ...status,
    lastTelemetryAt: status.lastTelemetryAt.toISOString()
  };
}

function toNullableJsonInput(value?: Prisma.JsonValue | null) {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}
