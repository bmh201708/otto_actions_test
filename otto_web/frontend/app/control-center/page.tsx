"use client";

import { useMemo, useState } from "react";

import { ActionCard } from "@/components/action-card";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { BaguaController } from "@/components/bagua-controller";
import { TelemetryPanel } from "@/components/telemetry-panel";
import { useRobotStatus } from "@/hooks/use-robot-status";
import { useVoiceSessionStatus } from "@/hooks/use-voice-session-status";
import { api } from "@/lib/api";

const quickActions = [
  {
    key: "actionDoubleGreet",
    icon: "emoji_people",
    label: "Bow",
    params: { repetitions: 2, amplitude: 12, tempo: 1100, armBias: 14 }
  },
  {
    key: "actionFullBodyWave",
    icon: "accessibility_new",
    label: "Dance",
    params: { cycles: 3, tempo: 1900 }
  },
  {
    key: "actionWaveGoodbye",
    icon: "waving_hand",
    label: "Wave",
    params: { repetitions: 3, amplitude: 18, tempo: 980, armBias: 48, style: "energetic" }
  },
  {
    key: "actionTwistHip",
    icon: "sync",
    label: "Spin",
    params: { cycles: 4, moveTime: 220, pauseTime: 130, style: "dramatic" }
  }
];

export default function ControlCenterPage() {
  const { status, setStatus, error } = useRobotStatus();
  const { voiceSession, deviceStatus, error: voiceError, refresh: refreshVoice } = useVoiceSessionStatus();
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [voicePending, setVoicePending] = useState<"start" | "stop" | null>(null);
  const [telemetryLog, setTelemetryLog] = useState<string[]>([
    "> Link established: Port 8080",
    "> Motor temp: Nominal (34°C)",
    "> Gyro: Calibrated",
    "> Awaiting command..."
  ]);
  const voiceBusy = Boolean(deviceStatus?.isListening) || voiceSession?.status === "transcribing" || voiceSession?.status === "responding";
  const controlsLocked = Boolean(pendingAction) || voiceBusy;

  const statusNote = useMemo(
    () => {
      if (actionError) return `Command failed: ${actionError}`;
      if (error) return `Robot link error: ${error}`;
      if (!status) return "Awaiting robot telemetry";
      if (!status.isOnline) return "Otto device offline";
      if (status.lastError) return `Robot reported: ${status.lastError}`;
      if (status.isBusy) return `Otto is executing: ${status.currentAction ?? "command"}`;
      return `Otto ready on ${status.signalStrength} link`;
    },
    [actionError, error, status]
  );

  const voiceNote = useMemo(() => {
    if (voiceError) return `Voice link error: ${voiceError}`;
    if (!voiceSession && !deviceStatus) return "Voice channel idle";
    if (deviceStatus?.isListening) return "Otto is recording from the on-board microphone";
    if (voiceSession?.status === "transcribing") return "Baidu STT is transcribing the uploaded audio";
    if (voiceSession?.status === "responding") return "LLM is generating Otto's reply";
    if (voiceSession?.status === "failed") return voiceSession.error ?? "Voice session failed";
    return "Voice channel ready";
  }, [deviceStatus, voiceError, voiceSession]);

  async function runAction(actionKey: string, params?: Record<string, unknown>) {
    setPendingAction(actionKey);
    setActionError(null);

    try {
      const data = await api.executeAction(actionKey, params);
      setStatus(data.status);
      setTelemetryLog((current) => [`> Executed ${actionKey}`, ...current].slice(0, 6));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to execute action";
      setActionError(message);
      setTelemetryLog((current) => [`> ERROR ${message}`, ...current].slice(0, 6));
    } finally {
      setPendingAction(null);
    }
  }

  async function move(direction: string) {
    setPendingAction(`move:${direction}`);
    setActionError(null);

    try {
      const data = await api.move(direction);
      setStatus(data.status);
      setTelemetryLog((current) => [`> Motion vector: ${direction}`, ...current].slice(0, 6));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to move robot";
      setActionError(message);
      setTelemetryLog((current) => [`> ERROR ${message}`, ...current].slice(0, 6));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <AuthGuard>
      <AppShell active="control-center">
        <div className="mx-auto flex w-full max-w-7xl gap-12 px-10 pb-20">
          <div className="flex-1">
            <div>
              <h2 className="font-display text-[5.5rem] font-black leading-none tracking-tight">Control Center</h2>
              <p className="mt-3 text-sm font-semibold uppercase tracking-[0.28em] text-on-surface/45">{statusNote}</p>
            </div>
            <BaguaController onMove={move} disabled={controlsLocked} />
            <div className="mt-10 max-w-[640px]">
              <TelemetryPanel status={status} />
            </div>
          </div>

          <div className="w-[380px] shrink-0 pt-4">
            <div className="mb-6 flex items-end justify-between">
              <h3 className="font-display text-4xl font-bold">Incantations</h3>
              <span className="text-sm uppercase tracking-[0.24em] text-on-surface/35">Quick Actions</span>
            </div>
            <div className="grid grid-cols-2 gap-5">
              {quickActions.map((action) => (
                <ActionCard
                  key={action.key}
                  icon={action.icon}
                  label={action.label}
                  disabled={controlsLocked}
                  loading={pendingAction === action.key}
                  onClick={() => void runAction(action.key, action.params)}
                />
              ))}
            </div>

            <div className="mt-8 rounded-[1.8rem] bg-surface-container-high p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
              <h4 className="mb-4 text-xs uppercase tracking-[0.24em] text-on-surface/45">Live Telemetry</h4>
              <div className="space-y-3 font-mono text-sm text-on-surface/80">
                {telemetryLog.map((line, index) => (
                  <p key={`${line}-${index}`} className={index === 0 ? "text-primary" : ""}>
                    {line}
                  </p>
                ))}
              </div>
            </div>

            <div className="mt-8 rounded-[1.8rem] bg-surface-container-high p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <h4 className="font-display text-3xl font-bold">Voice Relay</h4>
                  <p className="mt-1 text-xs uppercase tracking-[0.22em] text-on-surface/45">{voiceNote}</p>
                </div>
                <span className="rounded-full bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                  {voiceSession?.status ?? (deviceStatus?.isListening ? "recording" : "idle")}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  className="pill-button bg-gradient-to-r from-primary to-primary-container text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={controlsLocked || Boolean(deviceStatus?.isListening) || voicePending !== null}
                  onClick={() => {
                    setVoicePending("start");
                    setActionError(null);
                    void api
                      .startListening()
                      .then(() => {
                        setTelemetryLog((current) => ["> Voice session started", ...current].slice(0, 6));
                        return refreshVoice();
                      })
                      .catch((err) => {
                        const message = err instanceof Error ? err.message : "Unable to start listening";
                        setActionError(message);
                        setTelemetryLog((current) => [`> ERROR ${message}`, ...current].slice(0, 6));
                      })
                      .finally(() => setVoicePending(null));
                  }}
                >
                  {voicePending === "start" ? "Starting..." : "Start Listening"}
                </button>
                <button
                  className="pill-button border border-primary bg-transparent text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={voicePending !== null || !deviceStatus?.isListening}
                  onClick={() => {
                    setVoicePending("stop");
                    setActionError(null);
                    void api
                      .stopListening()
                      .then(() => {
                        setTelemetryLog((current) => ["> Voice session stopped", ...current].slice(0, 6));
                        return refreshVoice();
                      })
                      .catch((err) => {
                        const message = err instanceof Error ? err.message : "Unable to stop listening";
                        setActionError(message);
                        setTelemetryLog((current) => [`> ERROR ${message}`, ...current].slice(0, 6));
                      })
                      .finally(() => setVoicePending(null));
                  }}
                >
                  {voicePending === "stop" ? "Stopping..." : "Stop Listening"}
                </button>
              </div>
              <div className="mt-5 space-y-4">
                <div className="rounded-[1.3rem] bg-surface p-4">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-on-surface/40">Transcript</div>
                  <p className="min-h-[48px] text-sm leading-7 text-on-surface/72">
                    {voiceSession?.transcript || deviceStatus?.lastTranscriptPreview || "No transcript yet."}
                  </p>
                </div>
                <div className="rounded-[1.3rem] bg-surface p-4">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-on-surface/40">Otto Reply</div>
                  <p className="min-h-[48px] text-sm leading-7 text-on-surface/72">
                    {voiceSession?.assistantReply || "Otto has not responded yet."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
