import type { RobotStatus } from "@/lib/types";

export function TelemetryPanel({ status }: { status: RobotStatus | null }) {
  return (
    <div className="paper-card p-8">
      <h3 className="mb-6 flex items-center gap-3 font-display text-3xl font-bold">
        <span className="material-symbols-outlined text-primary">vital_signs</span>
        Vitals
      </h3>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.24em] text-on-surface/45">Battery Core</p>
          <div className="flex items-end gap-2">
            <span className="font-display text-5xl font-black">{status?.batteryPercent ?? "--"}%</span>
            <span className="material-symbols-outlined filled mb-1 text-primary">battery_4_bar</span>
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.24em] text-on-surface/45">Signal Strength</p>
          <div className="flex items-end gap-2">
            <span className="font-display text-5xl font-black">{status?.signalStrength ?? "Unknown"}</span>
            <span className="material-symbols-outlined mb-1 text-primary">wifi</span>
          </div>
        </div>
      </div>
    </div>
  );
}
