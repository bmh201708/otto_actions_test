export function ActionCard({
  icon,
  label,
  onClick,
  disabled = false,
  loading = false
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group aspect-square rounded-[1.8rem] bg-surface-container-low p-6 transition-all hover:-translate-y-0.5 hover:bg-surface-container-high hover:shadow-ambient disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-surface-container-low disabled:hover:shadow-none"
    >
      <div className="flex h-full flex-col items-center justify-center gap-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition-transform group-hover:scale-110 disabled:group-hover:scale-100">
          <span className="material-symbols-outlined text-[26px] text-primary">{loading ? "progress_activity" : icon}</span>
        </div>
        <span className="font-display text-3xl font-bold">{loading ? "Sending" : label}</span>
      </div>
    </button>
  );
}
