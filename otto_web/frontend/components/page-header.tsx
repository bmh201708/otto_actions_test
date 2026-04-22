export function PageHeader({
  eyebrow,
  title,
  right
}: {
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <section className="mb-8 flex items-end justify-between">
      <div>
        <p className="mb-2 font-label text-xs font-semibold uppercase tracking-[0.24em] text-on-surface/45">{eyebrow}</p>
        <h2 className="font-display text-6xl font-black tracking-tight">{title}</h2>
      </div>
      {right}
    </section>
  );
}
