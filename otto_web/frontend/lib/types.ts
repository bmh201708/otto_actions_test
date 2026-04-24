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
  lastError?: string | null;
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

export type ActionParamSpec = {
  type: "integer" | "number" | "boolean" | "enum";
  description: string;
  default: string | number | boolean;
  minimum?: number;
  maximum?: number;
  enumValues?: string[];
};

export type ActionSpec = {
  actionKey: string;
  label: string;
  description: string;
  params: Record<string, ActionParamSpec>;
};

export type Sequence = {
  id: string;
  name: string;
  description: string | null;
  steps: SequenceStep[];
  createdAt: string;
  updatedAt: string;
};

export type SequenceMutationInput = {
  name?: string;
  description?: string | null;
  steps?: Array<{
    label: string;
    actionKey: string;
    offsetMs: number;
    params?: Record<string, unknown> | null;
  }>;
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
  sttConfigured?: boolean;
  model: string | null;
  baseUrl: string | null;
  robotMode: string;
};

export type VoiceSession = {
  id: string;
  status: "idle" | "recording" | "uploaded" | "transcribing" | "responding" | "completed" | "failed";
  transcript: string | null;
  assistantReply: string | null;
  error: string | null;
  conversationId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DeviceVoiceStatus = {
  isListening: boolean;
  audioUploadState: "idle" | "recording" | "uploading" | "uploaded" | "failed";
  lastTranscriptPreview: string | null;
  activeVoiceSessionId: string | null;
};
