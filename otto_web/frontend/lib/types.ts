export type NavKey = "control-center" | "action-lab" | "oracle" | "settings";

export type User = {
  id: string;
  email: string;
  name: string;
};

export type RobotStatus = {
  isOnline: boolean;
  isBusy: boolean;
  batteryPercent: number;
  signalStrength: string;
  distanceCm: number;
  currentAction: string | null;
  lastTelemetryAt: string;
  coreTempC: number;
  memoryPercent: number;
  firmwareVersion: string;
};

export type OracleReading = {
  id: string;
  prompt: string;
  signNumber: number;
  title: string;
  quote: string;
  interpretation: string;
  recommendedActions: string[];
  elementalAffinity: string;
  status: "pending" | "completed" | "failed";
  createdAt: string;
};

export type SequenceStep = {
  id: string;
  label: string;
  actionKey: string;
  offsetMs: number;
  params?: Record<string, unknown> | null;
};

export type Sequence = {
  id: string;
  name: string;
  description: string | null;
  steps: SequenceStep[];
  createdAt: string;
  updatedAt: string;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type ConfigSnapshot = {
  llmConfigured: boolean;
  model: string | null;
  baseUrl: string | null;
  robotMode: string;
};
