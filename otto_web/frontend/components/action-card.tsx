export function ActionCard({
  icon,
  label,
  onClick
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group aspect-square rounded-[1.8rem] bg-surface-container-low p-6 transition-all hover:-translate-y-0.5 hover:bg-surface-container-high hover:shadow-ambient"
    >
      <div className="flex h-full flex-col items-center justify-center gap-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition-transform group-hover:scale-110">
          <span className="material-symbols-outlined text-[26px] text-primary">{icon}</span>
        </div>
        <span className="font-display text-3xl font-bold">{label}</span>
      </div>
    </button>
  );
}
