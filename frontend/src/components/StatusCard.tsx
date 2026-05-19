export function StatusCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "pass" | "fail" | "warn";
}) {
  return (
    <div className={`status-card tone-${tone}`}>
      <span className="label">{label}</span>
      <span className="value">{value}</span>
      <style>{`
        .status-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 12px; padding: 1rem 1.25rem;
        }
        .label { display: block; font-size: 0.75rem; color: var(--muted); margin-bottom: 0.35rem; }
        .value { font-size: 1.25rem; font-weight: 600; }
        .tone-pass .value { color: var(--pass); }
        .tone-fail .value { color: var(--fail); }
        .tone-warn .value { color: var(--warn); }
      `}</style>
    </div>
  );
}
