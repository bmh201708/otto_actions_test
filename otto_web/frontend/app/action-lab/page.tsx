"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { SequenceTimeline } from "@/components/sequence-timeline";
import { api } from "@/lib/api";
import type { Sequence, SequenceStep } from "@/lib/types";

const vaultItems = [
  { label: "Bow / Greet", icon: "pan_tool" },
  { label: "Extend Limb", icon: "open_with" },
  { label: "Chime Sequence A", icon: "graphic_eq" }
];

const fallbackSteps: SequenceStep[] = [
  { id: "boot", label: "Initialize", actionKey: "system_wakeup", offsetMs: 0 },
  { id: "bow", label: "Bow / Greet", actionKey: "actionDoubleGreet", offsetMs: 1500 }
];

export default function ActionLabPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [activeSequence, setActiveSequence] = useState<Sequence | null>(null);

  useEffect(() => {
    void api.getSequences().then((data) => {
      setSequences(data.sequences);
      if (data.sequences[0]) {
        setActiveSequence(data.sequences[0]);
      }
    });
  }, []);

  const steps = useMemo(() => activeSequence?.steps?.length ? activeSequence.steps : fallbackSteps, [activeSequence]);

  async function saveDefaultSequence() {
    const payload = {
      name: "Morning Awakening Ritual",
      description: "Signature wake and greet sequence",
      steps
    };
    const response = activeSequence
      ? await api.updateSequence(activeSequence.id, payload)
      : await api.saveSequence(payload);

    setActiveSequence(response.sequence);
    setSequences((current) => {
      const filtered = current.filter((item) => item.id !== response.sequence.id);
      return [response.sequence, ...filtered];
    });
  }

  async function executeSequence() {
    if (!activeSequence) return;
    await api.executeSequence(activeSequence.id);
  }

  return (
    <AuthGuard>
      <AppShell active="action-lab" searchPlaceholder="Search Talismans..." compactSearch>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-8 pb-16">
          <section className="flex items-end justify-between">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-on-surface/45">Sequence Builder</p>
              <h2 className="font-display text-[4.8rem] font-black tracking-tight">Morning Awakening Ritual</h2>
            </div>
            <div className="flex gap-3">
              <button onClick={() => void saveDefaultSequence()} className="pill-button bg-surface-container-highest text-on-surface">
                <span className="material-symbols-outlined text-[18px]">history</span>
                Revert
              </button>
              <button onClick={() => void executeSequence()} className="pill-button bg-gradient-to-r from-primary to-primary-container text-on-primary shadow-glow">
                <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                Execute Sequence
              </button>
            </div>
          </section>

          <div className="grid grid-cols-[270px_1fr] gap-6">
            <div className="flex flex-col gap-6">
              <div className="paper-card min-h-[430px] p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="font-display text-3xl font-bold">Talisman Vault</h3>
                  <span className="material-symbols-outlined text-on-surface/35">inventory_2</span>
                </div>
                <div className="space-y-6">
                  <div>
                    <p className="mb-3 ml-2 text-xs uppercase tracking-[0.24em] text-on-surface/35">Gestures</p>
                    <div className="space-y-3">
                      {vaultItems.slice(0, 2).map((item) => (
                        <div key={item.label} className="flex items-center gap-3 rounded-[1rem] bg-surface p-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-primary">
                            <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                          </div>
                          <span className="font-medium">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 ml-2 text-xs uppercase tracking-[0.24em] text-on-surface/35">Incantations</p>
                    <div className="rounded-[1rem] bg-surface p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-tertiary">
                          <span className="material-symbols-outlined text-[18px]">graphic_eq</span>
                        </div>
                        <span className="font-medium">{vaultItems[2].label}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.6rem] bg-surface-container-high p-6">
                <h4 className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface/45">Sequence Stability</h4>
                <div className="mt-4 flex items-end gap-3">
                  <span className="font-display text-5xl font-black">94</span>
                  <span className="mb-1 text-sm font-semibold text-primary">% Harmonic</span>
                </div>
                <div className="mt-4 h-2 rounded-full bg-surface">
                  <div className="h-2 w-[94%] rounded-full bg-primary" />
                </div>
                <div className="mt-5 flex justify-between text-sm text-on-surface/45">
                  <span>Complexity: Medium</span>
                  <span>Est. Time: 42s</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="relative h-64 overflow-hidden rounded-[1.6rem] border border-outline-variant/15 bg-surface-container-lowest">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-multiply" />
                <div className="absolute left-4 top-4 rounded-full border border-outline-variant/20 bg-surface/80 px-3 py-1.5 text-xs font-bold tracking-[0.2em] text-on-surface/65 backdrop-blur-md">
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-primary align-middle" />
                  Live Preview
                </div>
                <div className="relative z-10 flex h-full items-center justify-center">
                  <div className="absolute h-32 w-32 animate-[spin_10s_linear_infinite] rounded-full border border-primary/20" />
                  <div className="absolute h-24 w-24 animate-[spin_7s_linear_infinite_reverse] rounded-full border border-primary/40" />
                  <span className="material-symbols-outlined filled text-[68px] text-primary/80">smart_toy</span>
                </div>
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <button className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-highest text-on-surface/60">
                    <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                  </button>
                  <button className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-highest text-on-surface/60">
                    <span className="material-symbols-outlined text-[16px]">360</span>
                  </button>
                </div>
              </div>

              <SequenceTimeline steps={steps} />

              <div className="rounded-[1.6rem] bg-surface-container-low p-6">
                <h4 className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface/45">Saved Sequences</h4>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  {sequences.map((sequence) => (
                    <button
                      key={sequence.id}
                      onClick={() => setActiveSequence(sequence)}
                      className={`rounded-[1rem] p-4 text-left ${activeSequence?.id === sequence.id ? "bg-surface shadow-ambient" : "bg-surface/50"}`}
                    >
                      <div className="font-display text-2xl font-bold">{sequence.name}</div>
                      <div className="mt-2 text-sm text-on-surface/55">{sequence.steps.length} steps</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
