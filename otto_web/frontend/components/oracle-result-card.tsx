import type { OracleReading } from "@/lib/types";

export function OracleResultCard({
  reading,
  streamedInterpretation
}: {
  reading: OracleReading | null;
  streamedInterpretation?: string;
}) {
  const actions = reading?.recommendedActions?.length ? reading.recommendedActions : ["No guidance recorded yet."];

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-primary/10 bg-surface-container-lowest p-10 shadow-talisman">
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/8 to-transparent" />
      <div className="absolute right-0 top-0 h-40 w-40 rounded-bl-[5rem] bg-primary/6 blur-2xl" />

      <div className="relative space-y-8">
        <div className="flex items-start justify-between gap-8 border-b border-primary/15 pb-8">
          <div className="max-w-3xl">
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-full bg-primary px-4 py-1 text-xs font-bold uppercase tracking-[0.28em] text-on-primary">
                Sign {reading?.signNumber ?? "--"}
              </span>
              <span className="rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                Oracle Transmission
              </span>
            </div>

            <h3 className="font-display text-[3.6rem] font-black leading-[0.95] tracking-tight">
              {reading?.title ?? "Awaiting Revelation"}
            </h3>

            <div className="mt-5 rounded-[1.75rem] bg-surface-container-low px-6 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
              <p className="font-display text-[1.8rem] italic leading-9 text-on-surface-variant">
                {reading?.quote ?? "The scroll remains silent until the next invocation."}
              </p>
            </div>
          </div>

          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/8 shadow-[0_16px_35px_-22px_rgba(183,16,42,0.7)]">
            <span className="font-display text-5xl font-bold text-primary">吉</span>
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] gap-6">
          <div className="rounded-[1.75rem] border border-primary/10 bg-gradient-to-br from-surface to-surface-container-low px-7 py-6">
            <h4 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">visibility</span>
              Interpretation
            </h4>
            <p className="whitespace-pre-wrap text-lg leading-9 text-on-surface/85">
              {streamedInterpretation || reading?.interpretation || "Invoke the oracle to generate guidance."}
            </p>
          </div>

          <div className="space-y-5">
            <div className="rounded-[1.75rem] border border-primary/10 bg-surface-container-low px-7 py-6">
              <h4 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-on-surface-variant">
                <span className="material-symbols-outlined text-[18px]">directions_run</span>
                Recommended Actions
              </h4>

              <ul className="space-y-4 text-base leading-7 text-on-surface/85">
                {actions.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2.5 h-2 w-2 rounded-full bg-primary shadow-[0_0_0_5px_rgba(183,16,42,0.08)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between rounded-[1.75rem] border border-primary/10 bg-gradient-to-r from-primary/6 to-transparent px-7 py-5">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-on-surface/45">Elemental Affinity</div>
                <div className="mt-2 font-display text-[2rem] leading-none">{reading?.elementalAffinity ?? "Wood / Fire"}</div>
              </div>

              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <span className="material-symbols-outlined text-primary">air</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-[1.4rem] bg-surface-container-low px-5 py-4 text-sm text-on-surface/60">
          <span className="material-symbols-outlined text-primary">auto_awesome</span>
          <span>The latest interpretation streams in real time and then settles into the saved oracle record.</span>
        </div>
      </div>
    </div>
  );
}
