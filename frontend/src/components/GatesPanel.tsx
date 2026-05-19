import type { GateItem } from "@/api/types";

export function GatesPanel({ gates }: { gates: GateItem[] }) {
  return (
    <div className="gates-panel">
      <table>
        <thead>
          <tr>
            <th>Gate</th>
            <th>Status</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {gates.map((g) => (
            <tr key={g.id}>
              <td>
                <span className="mono">{g.id}</span> {g.name}
              </td>
              <td>
                <span className={`pill pill-${g.status}`}>{g.status}</span>
              </td>
              <td className="detail">{g.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <style>{`
        .gates-panel { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
        th, td { text-align: left; padding: 0.6rem 0.5rem; border-bottom: 1px solid var(--border); }
        th { color: var(--muted); font-weight: 500; font-size: 0.75rem; text-transform: uppercase; }
        .detail { color: var(--muted); max-width: 320px; }
        .pill {
          display: inline-block; padding: 0.15rem 0.5rem; border-radius: 999px;
          font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
        }
        .pill-pass { background: rgba(82,183,136,0.2); color: var(--pass); }
        .pill-fail { background: rgba(231,111,111,0.2); color: var(--fail); }
        .pill-warn { background: rgba(244,162,97,0.2); color: var(--warn); }
        .pill-skip { background: var(--surface-2); color: var(--muted); }
      `}</style>
    </div>
  );
}
