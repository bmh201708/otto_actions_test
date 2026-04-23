import type {
  ConfigSnapshot,
  Conversation,
  DeviceVoiceStatus,
  Message,
  OracleReading,
  RobotStatus,
  Sequence,
  User,
  VoiceSession
} from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      },
      cache: "no-store"
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out");
    }

    throw error;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Request failed" }));
    const errorMessage =
      body.error === "This operation was aborted" ? "Robot device request timed out" : body.error ?? "Request failed";
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

export const api = {
  baseUrl: API_BASE,
  login: (email: string, password: string) =>
    request<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  me: () => request<{ user: User }>("/api/auth/me"),
  getRobotStatus: () => request<{ status: RobotStatus }>("/api/robot/status"),
  executeAction: (actionKey: string, params?: Record<string, unknown>) =>
    request<{ status: RobotStatus }>(`/api/robot/actions/${actionKey}/execute`, {
      method: "POST",
      body: JSON.stringify(params ?? {})
    }),
  move: (direction: string) =>
    request<{ status: RobotStatus }>("/api/robot/move", {
      method: "POST",
      body: JSON.stringify({ direction })
    }),
  speak: (text: string) =>
    request<{ status: RobotStatus }>("/api/robot/speak", {
      method: "POST",
      body: JSON.stringify({ text })
    }),
  calibrate: () =>
    request<{ status: RobotStatus }>("/api/robot/calibrate", {
      method: "POST"
    }),
  getConfig: () => request<{ config: ConfigSnapshot }>("/api/config"),
  startListening: () =>
    request<{ voiceSession: VoiceSession; deviceStatus: DeviceVoiceStatus }>("/api/voice/listen/start", {
      method: "POST"
    }),
  stopListening: () =>
    request<{ voiceSession: VoiceSession; deviceStatus: DeviceVoiceStatus }>("/api/voice/listen/stop", {
      method: "POST"
    }),
  getVoiceStatus: () => request<{ voiceSession: VoiceSession | null; deviceStatus: DeviceVoiceStatus }>("/api/voice/status"),
  drawOracle: (prompt: string) =>
    request<{ reading: OracleReading }>("/api/oracle/draw", {
      method: "POST",
      body: JSON.stringify({ prompt })
    }),
  getOracleHistory: () => request<{ readings: OracleReading[] }>("/api/oracle/history"),
  getSequences: () => request<{ sequences: Sequence[] }>("/api/action-lab/sequences"),
  getSequence: (id: string) => request<{ sequence: Sequence }>(`/api/action-lab/sequences/${id}`),
  saveSequence: (payload: Partial<Sequence>) =>
    request<{ sequence: Sequence }>("/api/action-lab/sequences", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateSequence: (id: string, payload: Partial<Sequence>) =>
    request<{ sequence: Sequence }>(`/api/action-lab/sequences/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  executeSequence: (id: string) =>
    request<{ status: RobotStatus }>(`/api/action-lab/sequences/${id}/execute`, {
      method: "POST"
    }),
  listConversations: () => request<{ conversations: Conversation[] }>("/api/chat/conversations"),
  listMessages: (conversationId: string) =>
    request<{ messages: Message[] }>(`/api/chat/conversations/${conversationId}/messages`),
  createMessage: (conversationId: string | null, content: string) =>
    request<{ conversationId: string; assistantMessageId: string }>("/api/chat/messages", {
      method: "POST",
      body: JSON.stringify({ conversationId, content })
    }),
  oracleStreamUrl: (readingId: string) => `${API_BASE}/api/oracle/stream/${readingId}`,
  chatStreamUrl: (conversationId: string, assistantMessageId: string) =>
    `${API_BASE}/api/chat/stream/${conversationId}?assistantMessageId=${assistantMessageId}`
};
