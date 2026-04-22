import type { OracleReading } from "@/lib/types";

export function OracleResultCard({
  reading,
  streamedInterpretation
}: {
  reading: OracleReading | null;
  streamedInterpretation?: string;
}) {
  return (
    <div className="relative h-full overflow-hidden rounded-[2rem] bg-surface-container-lowest p-12 shadow-talisman">
      <div className="absolute right-0 top-0 h-36 w-36 rounded-bl-[5rem] bg-primary/5" />
      <div className="space-y-10">
        <div className="relative border-b border-primary/20 pb-8">
          <div className="absolute right-0 top-0 flex h-16 w-16 items-center justify-center rounded-full bg-primary/8">
            <span className="font-display text-4xl font-bold text-primary">吉</span>
          </div>
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.28em] text-primary">
            Sign {reading?.signNumber ?? "--"}
          </p>
          <h3 className="font-display text-[4rem] font-black leading-none tracking-tight">
            {reading?.title ?? "Awaiting Revelation"}
          </h3>
          <p className="mt-4 max-w-2xl font-display text-3xl italic text-on-surface-variant">
            {reading?.quote ?? "The scroll remains silent until the next invocation."}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h4 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">visibility</span>
              Interpretation
            </h4>
            <p className="min-h-[220px] whitespace-pre-wrap text-lg leading-9 text-on-surface/85">
              {streamedInterpretation || reading?.interpretation || "Invoke the oracle to generate guidance."}
            </p>
          </div>
          <div>
            <h4 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">directions_run</span>
              Recommended Actions
            </h4>
            <ul className="space-y-4 text-lg leading-8 text-on-surface/85">
              {(reading?.recommendedActions ?? ["No guidance recorded yet."]).map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-3 h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-surface-container-low px-8 py-6">
          <span className="text-xs uppercase tracking-[0.24em] text-on-surface/45">Elemental Affinity</span>
          <span className="font-display text-3xl">{reading?.elementalAffinity ?? "Wood / Fire"}</span>
        </div>
      </div>
    </div>
  );
}
