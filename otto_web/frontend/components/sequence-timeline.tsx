import type { SequenceStep } from "@/lib/types";

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

export function SequenceTimeline({
  steps,
  onClear,
  onRemove
}: {
  steps: SequenceStep[];
  onClear?: () => void;
  onRemove?: (stepId: string) => void;
}) {
  return (
    <div className="flex h-full flex-col rounded-[1.6rem] bg-surface-container-low p-6">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">linear_scale</span>
          <h3 className="font-display text-3xl font-bold">Orchestration Thread</h3>
        </div>
        <button
          onClick={onClear}
          disabled={!steps.length}
          className="rounded-full bg-surface px-4 py-2 text-xs uppercase tracking-[0.24em] text-on-surface/55 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Clear All
        </button>
      </div>
      <div className="relative flex-1 overflow-x-auto scrollbar-thin px-2 py-4">
        <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-outline-variant/30" />
        <div className="relative z-10 flex min-h-[180px] items-center gap-6">
          {steps.length ? (
            steps.map((step, index) => (
              <div key={step.id} className="relative w-48 rounded-[1.25rem] bg-surface p-4 shadow-[0_8px_24px_-12px_rgba(27,29,14,0.12)]">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-on-primary">
                  {(step.offsetMs / 1000).toFixed(1)}s
                </div>
                <button
                  onClick={() => onRemove?.(step.id)}
                  className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-surface-container text-on-surface/45 transition-colors hover:text-primary"
                  aria-label={`Remove ${step.label}`}
                >
                  <span className="material-symbols-outlined text-[15px]">close</span>
                </button>
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container text-primary">
                    <span className="material-symbols-outlined text-[16px]">
                      {iconsByAction[step.actionKey] ?? "gesture"}
                    </span>
                  </div>
                  <span className="truncate pr-7 text-sm font-bold">{step.label}</span>
                </div>
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface/35">
                  Step {index + 1}
                </div>
                <div className="border-t border-outline-variant/20 pt-2 text-xs text-on-surface/50">{step.actionKey}</div>
              </div>
            ))
          ) : (
            <div className="flex h-40 w-full items-center justify-center rounded-[1.4rem] border-2 border-dashed border-outline-variant/40 bg-surface/35 text-center text-on-surface/42">
              <div>
                <span className="material-symbols-outlined text-[28px]">auto_awesome_motion</span>
                <p className="mt-3 text-xs uppercase tracking-[0.28em]">Add actions from the vault</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
