import type { SequenceStep } from "@/lib/types";

export function SequenceTimeline({ steps }: { steps: SequenceStep[] }) {
  return (
    <div className="flex h-full flex-col rounded-[1.6rem] bg-surface-container-low p-6">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">linear_scale</span>
          <h3 className="font-display text-3xl font-bold">Orchestration Thread</h3>
        </div>
        <button className="rounded-full bg-surface px-4 py-2 text-xs uppercase tracking-[0.24em] text-on-surface/55">
          Clear All
        </button>
      </div>
      <div className="relative flex-1 overflow-x-auto scrollbar-thin px-2 py-4">
        <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-outline-variant/30" />
        <div className="relative z-10 flex min-h-[180px] items-center gap-6">
          {steps.map((step) => (
            <div key={step.id} className="relative w-44 rounded-[1.25rem] bg-surface p-4 shadow-[0_8px_24px_-12px_rgba(27,29,14,0.12)]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-on-primary">
                {(step.offsetMs / 1000).toFixed(1)}s
              </div>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container text-primary">
                  <span className="material-symbols-outlined text-[14px]">pan_tool</span>
                </div>
                <span className="truncate text-sm font-bold">{step.label}</span>
              </div>
              <div className="border-t border-outline-variant/20 pt-2 text-xs text-on-surface/50">{step.actionKey}</div>
            </div>
          ))}
          <div className="flex h-28 w-40 flex-col items-center justify-center rounded-[1.25rem] border-2 border-dashed border-outline-variant/50 text-on-surface/40">
            <span className="material-symbols-outlined">add</span>
            <span className="text-xs uppercase tracking-[0.24em]">Drop Talisman</span>
          </div>
        </div>
      </div>
    </div>
  );
}
