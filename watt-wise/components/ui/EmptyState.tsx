export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {hint ? <p className="muted">{hint}</p> : null}
      {action}
    </div>
  );
}
