"use client";

import { useMemo, useState } from "react";

import { ActionCard } from "@/components/action-card";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { BaguaController } from "@/components/bagua-controller";
import { TelemetryPanel } from "@/components/telemetry-panel";
import { useRobotStatus } from "@/hooks/use-robot-status";
import { api } from "@/lib/api";

const quickActions = [
  { key: "actionDoubleGreet", icon: "emoji_people", label: "Bow" },
  { key: "actionFullBodyWave", icon: "accessibility_new", label: "Dance" },
  { key: "actionWaveGoodbye", icon: "waving_hand", label: "Wave" },
  { key: "actionTwistHip", icon: "sync", label: "Spin" }
];

export default function ControlCenterPage() {
  const { status, setStatus } = useRobotStatus();
  const [telemetryLog, setTelemetryLog] = useState<string[]>([
    "> Link established: Port 8080",
    "> Motor temp: Nominal (34°C)",
    "> Gyro: Calibrated",
    "> Awaiting command..."
  ]);

  const statusNote = useMemo(
    () => (status?.isBusy ? "Otto is executing a ritual." : "Otto Prime Link Established"),
    [status?.isBusy]
  );

  async function runAction(actionKey: string) {
    const data = await api.executeAction(actionKey);
    setStatus(data.status);
    setTelemetryLog((current) => [`> Executed ${actionKey}`, ...current].slice(0, 6));
  }

  async function move(direction: string) {
    const data = await api.move(direction);
    setStatus(data.status);
    setTelemetryLog((current) => [`> Motion vector: ${direction}`, ...current].slice(0, 6));
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
            <BaguaController onMove={move} />
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
                <ActionCard key={action.key} icon={action.icon} label={action.label} onClick={() => void runAction(action.key)} />
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
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
