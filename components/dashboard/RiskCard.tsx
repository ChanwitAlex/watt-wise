export function RiskCard({
  title,
  value,
  hint,
  badge,
  wide = false,
  children,
}: {
  title: string;
  value: string;
  hint?: string;
  badge?: React.ReactNode;
  wide?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className={`card${wide ? " card--wide" : ""}`}>
      <h2 className="card__title">{title}</h2>
      <p className="card__value">
        {value} {badge}
      </p>
      {children}
      {hint ? <p className="muted card__hint">{hint}</p> : null}
    </section>
  );
}
