"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { SequenceTimeline } from "@/components/sequence-timeline";
import { api } from "@/lib/api";
import type { ActionSpec, Sequence, SequenceStep } from "@/lib/types";

const iconsByAction: Record<string, string> = {
  actionWaveGoodbye: "waving_hand",
  actionDoubleGreet: "pan_tool",
  actionCheer: "celebration",
  actionWalk: "directions_walk",
  actionTwistHip: "sync",
  actionFullBodyWave: "accessibility_new",
  actionSleep: "bedtime",
  actionHeroPose: "bolt"
};

const durationHints: Record<string, number> = {
  actionWaveGoodbye: 3000,
  actionDoubleGreet: 2800,
  actionCheer: 2400,
  actionWalk: 3200,
  actionTwistHip: 2600,
  actionFullBodyWave: 3600,
  actionSleep: 5000,
  actionHeroPose: 2200
};

function buildStepId() {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildDefaultParams(action: ActionSpec) {
  return Object.fromEntries(Object.entries(action.params).map(([key, spec]) => [key, spec.default]));
}

function normalizeStepsForSave(steps: SequenceStep[]) {
  return steps.map(({ label, actionKey, offsetMs, params }) => ({
    label,
    actionKey,
    offsetMs,
    params: params ?? null
  }));
}

export default function ActionLabPage() {
  const [actions, setActions] = useState<ActionSpec[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [activeSequence, setActiveSequence] = useState<Sequence | null>(null);
  const [draftSteps, setDraftSteps] = useState<SequenceStep[]>([]);
  const [statusMessage, setStatusMessage] = useState("Load a saved ritual or compose one from the vault.");
  const [busy, setBusy] = useState<"save" | "execute" | null>(null);

  useEffect(() => {
    void Promise.all([api.getSequences(), api.getRobotActions()]).then(([sequenceData, actionData]) => {
      setSequences(sequenceData.sequences);
      setActions(actionData.actions);

      if (sequenceData.sequences[0]) {
        setActiveSequence(sequenceData.sequences[0]);
        setDraftSteps(sequenceData.sequences[0].steps);
      }
    });
  }, []);

  const groupedActions = useMemo(() => {
    const expressive = actions.filter((action) =>
      ["actionWaveGoodbye", "actionDoubleGreet", "actionCheer", "actionFullBodyWave", "actionHeroPose"].includes(
        action.actionKey
      )
    );
    const motion = actions.filter((action) => ["actionWalk", "actionTwistHip"].includes(action.actionKey));
    const calm = actions.filter((action) => ["actionSleep"].includes(action.actionKey));
    return { expressive, motion, calm };
  }, [actions]);

  const estimatedDuration = useMemo(() => {
    if (!draftSteps.length) return 0;
    const finalStep = draftSteps[draftSteps.length - 1];
    return finalStep.offsetMs + (durationHints[finalStep.actionKey] ?? 2500);
  }, [draftSteps]);

  const stability = useMemo(() => {
    if (!draftSteps.length) return 0;
    return Math.max(62, Math.min(98, 100 - draftSteps.length * 3));
  }, [draftSteps]);

  function selectSequence(sequence: Sequence) {
    setActiveSequence(sequence);
    setDraftSteps(sequence.steps);
    setStatusMessage(`Loaded ${sequence.name}.`);
  }

  function addAction(action: ActionSpec) {
    setDraftSteps((current) => {
      const previous = current[current.length - 1];
      const offsetMs = previous ? previous.offsetMs + (durationHints[previous.actionKey] ?? 2500) : 0;
      const nextStep: SequenceStep = {
        id: buildStepId(),
        label: action.label,
        actionKey: action.actionKey,
        offsetMs,
        params: buildDefaultParams(action)
      };
      return [...current, nextStep];
    });
    setStatusMessage(`Added ${action.label} to the orchestration thread.`);
  }

  function clearAll() {
    setDraftSteps([]);
    setStatusMessage("Orchestration thread cleared.");
  }

  function removeStep(stepId: string) {
    setDraftSteps((current) => {
      const filtered = current.filter((step) => step.id !== stepId);
      return filtered.map((step, index) => {
        if (index === 0) {
          return { ...step, offsetMs: 0 };
        }
        const previous = filtered[index - 1];
        return {
          ...step,
          offsetMs: previous.offsetMs + (durationHints[previous.actionKey] ?? 2500)
        };
      });
    });
    setStatusMessage("Step removed from the thread.");
  }

  async function persistSequence() {
    const payload = {
      name: activeSequence?.name ?? "Curated Exhibition Ritual",
      description: activeSequence?.description ?? "Action Lab composed sequence",
      steps: normalizeStepsForSave(draftSteps)
    };

    const response = activeSequence
      ? await api.updateSequence(activeSequence.id, payload)
      : await api.saveSequence(payload);

    setActiveSequence(response.sequence);
    setDraftSteps(response.sequence.steps);
    setSequences((current) => {
      const filtered = current.filter((item) => item.id !== response.sequence.id);
      return [response.sequence, ...filtered];
    });
    return response.sequence;
  }

  async function saveSequence() {
    setBusy("save");
    try {
      await persistSequence();
      setStatusMessage("Sequence saved to the ritual archive.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to save sequence.");
    } finally {
      setBusy(null);
    }
  }

  async function executeSequence() {
    if (!draftSteps.length) {
      setStatusMessage("Add at least one action before executing the thread.");
      return;
    }

    setBusy("execute");
    try {
      const saved = await persistSequence();
      await api.executeSequence(saved.id);
      setStatusMessage(`Executing ${saved.name} on Otto now.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to execute sequence.");
    } finally {
      setBusy(null);
    }
  }

  function renderVaultGroup(title: string, list: ActionSpec[]) {
    return (
      <div>
        <p className="mb-3 ml-2 text-xs uppercase tracking-[0.24em] text-on-surface/35">{title}</p>
        <div className="space-y-3">
          {list.map((action) => (
            <button
              key={action.actionKey}
              onClick={() => addAction(action)}
              className="flex w-full items-start gap-3 rounded-[1rem] bg-surface p-3 text-left transition-transform hover:-translate-y-0.5 hover:shadow-ambient"
            >
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-primary">
                <span className="material-symbols-outlined text-[18px]">{iconsByAction[action.actionKey] ?? "gesture"}</span>
              </div>
              <div className="min-w-0">
                <div className="font-medium">{action.label}</div>
                <div className="mt-1 text-sm leading-6 text-on-surface/55">{action.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <AppShell active="action-lab" searchPlaceholder="Search Talismans..." compactSearch>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-8 pb-16">
          <section className="flex items-end justify-between">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-on-surface/45">Sequence Builder</p>
              <h2 className="font-display text-[4.8rem] font-black tracking-tight">
                {activeSequence?.name ?? "Curated Exhibition Ritual"}
              </h2>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => void saveSequence()}
                disabled={busy !== null}
                className="pill-button bg-surface-container-highest text-on-surface disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                {busy === "save" ? "Saving..." : "Save Sequence"}
              </button>
              <button
                onClick={() => void executeSequence()}
                disabled={busy !== null || !draftSteps.length}
                className="pill-button bg-gradient-to-r from-primary to-primary-container text-on-primary shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                {busy === "execute" ? "Executing..." : "Execute Sequence"}
              </button>
            </div>
          </section>

          <div className="grid grid-cols-[290px_1fr] gap-6">
            <div className="flex flex-col gap-6">
              <div className="paper-card min-h-[430px] p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="font-display text-3xl font-bold">Talisman Vault</h3>
                  <span className="material-symbols-outlined text-on-surface/35">inventory_2</span>
                </div>
                <div className="space-y-6">
                  {renderVaultGroup("Gestures", groupedActions.expressive)}
                  {renderVaultGroup("Movement", groupedActions.motion)}
                  {renderVaultGroup("Calm", groupedActions.calm)}
                </div>
              </div>

              <div className="rounded-[1.6rem] bg-surface-container-high p-6">
                <h4 className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface/45">Sequence Stability</h4>
                <div className="mt-4 flex items-end gap-3">
                  <span className="font-display text-5xl font-black">{stability}</span>
                  <span className="mb-1 text-sm font-semibold text-primary">% Harmonic</span>
                </div>
                <div className="mt-4 h-2 rounded-full bg-surface">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${stability}%` }} />
                </div>
                <div className="mt-5 flex justify-between text-sm text-on-surface/45">
                  <span>Complexity: {draftSteps.length > 5 ? "High" : draftSteps.length > 2 ? "Medium" : "Light"}</span>
                  <span>Est. Time: {(estimatedDuration / 1000).toFixed(1)}s</span>
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
                <div className="absolute bottom-4 left-4 right-4 rounded-[1rem] bg-surface/75 px-4 py-3 text-sm text-on-surface/70 backdrop-blur">
                  {statusMessage}
                </div>
              </div>

              <SequenceTimeline steps={draftSteps} onClear={clearAll} onRemove={removeStep} />

              <div className="rounded-[1.6rem] bg-surface-container-low p-6">
                <h4 className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface/45">Saved Sequences</h4>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  {sequences.map((sequence) => (
                    <button
                      key={sequence.id}
                      onClick={() => selectSequence(sequence)}
                      className={`rounded-[1rem] p-4 text-left ${
                        activeSequence?.id === sequence.id ? "bg-surface shadow-ambient" : "bg-surface/50"
                      }`}
                    >
                      <div className="font-display text-2xl font-bold">{sequence.name}</div>
                      <div className="mt-2 text-sm text-on-surface/55">{sequence.steps.length} steps</div>
                    </button>
                  ))}
                  {!sequences.length && (
                    <div className="col-span-2 rounded-[1rem] bg-surface/50 p-4 text-sm text-on-surface/55">
                      No saved sequences yet. Build one from the vault and save it.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
