"use client";

import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { api } from "@/lib/api";
import type { ConfigSnapshot, RobotStatus } from "@/lib/types";

export default function SettingsPage() {
  const [status, setStatus] = useState<RobotStatus | null>(null);
  const [config, setConfig] = useState<ConfigSnapshot | null>(null);

  useEffect(() => {
    void api
      .getRobotStatus()
      .then((data) => setStatus(data.status))
      .catch(() => setStatus(null));
    void api
      .getConfig()
      .then((data) => setConfig(data.config))
      .catch(() => setConfig(null));
  }, []);

  return (
    <AuthGuard>
      <AppShell active="settings" searchPlaceholder="Search parameters..." compactSearch>
        <div className="mx-auto w-full max-w-7xl px-10 pb-24">
          <div>
            <h2 className="font-display text-[5rem] font-black leading-none tracking-tight">System Settings</h2>
            <p className="mt-3 text-sm font-semibold uppercase tracking-[0.28em] text-on-surface/45">Connection Vault</p>
          </div>

          <div className="mt-10 grid grid-cols-[1.25fr_0.9fr] gap-8">
            <div className="space-y-8">
              <div className="paper-card flex items-center justify-between p-10">
                <div className="max-w-md">
                  <div className="mb-4 flex items-center gap-3 text-primary">
                    <span className="material-symbols-outlined">radar</span>
                    <span className="text-xs uppercase tracking-[0.24em]">Search Node</span>
                  </div>
                  <h3 className="font-display text-4xl font-bold leading-tight">Searching for Essence</h3>
                  <p className="mt-4 max-w-sm text-lg leading-8 text-on-surface/65">
                    Scan physical environment for unregistered Otto hardware modules to sync.
                  </p>
                </div>
                <button className="pill-button bg-gradient-to-r from-primary to-primary-container text-on-primary shadow-glow">
                  Initiate Scan
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="paper-card p-8">
                  <div className="mb-8 flex items-center justify-between">
                    <h3 className="font-display text-3xl font-bold">Kinematics</h3>
                    <span className="material-symbols-outlined text-on-surface/15">change_history</span>
                  </div>
                  <div className="space-y-8">
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm font-semibold uppercase tracking-[0.2em] text-on-surface/55">
                        <span>Actuator Speed</span>
                        <span>85%</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface">
                        <div className="h-2 w-[85%] rounded-full bg-primary" />
                      </div>
                      <div className="mt-3 flex justify-between text-xs uppercase tracking-[0.18em] text-on-surface/35">
                        <span>Meditative</span>
                        <span>Kinetic</span>
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm font-semibold uppercase tracking-[0.2em] text-on-surface/55">
                        <span>Voice Resonance</span>
                        <span>40%</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface">
                        <div className="h-2 w-[40%] rounded-full bg-on-surface" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="paper-card p-8">
                  <div className="mb-8 flex items-center justify-between">
                    <h3 className="font-display text-3xl font-bold">Sensory Input</h3>
                    <span className="h-7 w-7 rounded-full bg-on-surface/10" />
                  </div>
                  <div className="space-y-8">
                    {[
                      { title: "Auto-Focus Vision", body: "Lidar-assisted optical tracking", active: true },
                      { title: "Haptic Sync", body: "Vibrational feedback to controller", active: false },
                      { title: "Zen Mode", body: "Limit notifications to critical only", active: false }
                    ].map((item) => (
                      <div key={item.title} className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-semibold">{item.title}</div>
                          <div className="mt-1 text-sm text-on-surface/55">{item.body}</div>
                        </div>
                        <div className={`mt-1 flex h-7 w-12 items-center rounded-full p-1 ${item.active ? "bg-primary" : "bg-on-surface/15"}`}>
                          <div className={`h-5 w-5 rounded-full bg-surface transition-transform ${item.active ? "translate-x-5" : ""}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="paper-card p-8">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-3xl font-bold">Firmware Soul</h3>
                  <span className="rounded-full bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
                    Stable
                  </span>
                </div>
                <div className="mt-8 text-5xl font-display font-black">{status?.firmwareVersion ?? "V.4.2.8"}</div>
                <p className="mt-2 text-on-surface/55">Last inscribed: 3 days ago</p>
                <div className="mt-8 rounded-[1.4rem] bg-surface-container-lowest p-5">
                  <div className="font-semibold">Alchemy Update Available</div>
                  <p className="mt-2 text-sm leading-6 text-on-surface/55">
                    Improves pathfinding in dense environments. Approx 4 min.
                  </p>
                </div>
                <button className="mt-8 pill-button w-full border border-primary bg-transparent text-primary hover:bg-primary/5">
                  Inscribe Update
                </button>
              </div>

              <div>
                <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-on-surface/45">Vital Diagnostics</h4>
                <div className="space-y-5">
                  {[
                    { label: "Core Temp", value: `${status?.coreTempC ?? 42}°C`, icon: "thermostat" },
                    { label: "Telemetry Link", value: status?.signalStrength ?? "Excellent (-45dBm)", icon: "wifi" },
                    { label: "Memory Buffer", value: `${status?.memoryPercent ?? 12}% Used`, icon: "dns" }
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
                      <div className="flex items-center gap-3 text-on-surface/65">
                        <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                      <div>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-8 rounded-[1.5rem] bg-surface-container-low p-6">
                  <h5 className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface/45">Backend Configuration</h5>
                  <div className="mt-4 space-y-3 text-sm text-on-surface/70">
                    <div>LLM Configured: {config?.llmConfigured ? "Yes" : "No"}</div>
                    <div>STT Configured: {config?.sttConfigured ? "Yes" : "No"}</div>
                    <div>Provider Base URL: {config?.baseUrl ?? "Not configured"}</div>
                    <div>Robot Mode: {config?.robotMode ?? "mock"}</div>
                    <div>Model: {config?.model ?? "Not configured"}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
