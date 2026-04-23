"use client";

const directions = [
  { key: "forward", icon: "keyboard_arrow_up", position: "top-7 left-1/2 -translate-x-1/2" },
  { key: "left", icon: "keyboard_arrow_left", position: "left-7 top-1/2 -translate-y-1/2" },
  { key: "right", icon: "keyboard_arrow_right", position: "right-7 top-1/2 -translate-y-1/2" },
  { key: "backward", icon: "keyboard_arrow_down", position: "bottom-7 left-1/2 -translate-x-1/2" }
] as const;

export function BaguaController({ onMove, disabled = false }: { onMove: (direction: string) => void; disabled?: boolean }) {
  return (
    <div className="relative mx-auto mt-8 aspect-square w-full max-w-[540px]">
      <div className="absolute inset-0 rounded-full border border-outline-variant/20 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.25),transparent_62%)] shadow-[0_0_80px_rgba(255,250,220,0.9)]" />
      <div className="absolute inset-[10%] rounded-full bagua-ring opacity-90" />
      <div className="absolute inset-[16%] rounded-full bg-surface-container shadow-[inset_0_30px_50px_rgba(255,255,255,0.45),0_20px_36px_-18px_rgba(27,29,14,0.22)]">
        {directions.map((direction) => (
          <button
            key={direction.key}
            onClick={() => onMove(direction.key)}
            disabled={disabled}
            className={`absolute ${direction.position} flex h-16 w-16 items-center justify-center rounded-full bg-surface text-primary shadow-[0_10px_24px_-16px_rgba(27,29,14,0.35)] transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100`}
          >
            <span className="material-symbols-outlined text-[32px]">{direction.icon}</span>
          </button>
        ))}
        <div className="absolute left-1/2 top-1/2 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-surface-bright shadow-[inset_0_10px_30px_rgba(255,255,255,0.7)]">
          <div className="h-4 w-4 rounded-full bg-primary/15" />
        </div>
      </div>
    </div>
  );
}
