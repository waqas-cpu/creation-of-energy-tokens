import { GatesPanel } from "@/components/GatesPanel";
import { StatusCard } from "@/components/StatusCard";
import { useGates, usePipelineStatus } from "@/hooks/useSettlementApi";

export function DashboardPage() {
  const status = usePipelineStatus();
  const gates = useGates();

  const s = status.data;
  const connected = s?.health?.ok === true;
  const gateReady = s?.gatesReady === true;

  return (
    <div>
      <header className="page-header">
        <h1>Dashboard</h1>
        <p>Layer 5 settlement backend — health, gates, and pipeline status.</p>
      </header>

      {status.isError && (
        <p className="banner fail">
          Cannot reach API: {status.error instanceof Error ? status.error.message : "unknown"}
        </p>
      )}
      {s?.lastError && !connected && (
        <p className="banner fail">{s.lastError}</p>
      )}

      <div className="cards">
        <StatusCard
          label="Backend health"
          value={connected ? "Online" : status.isLoading ? "…" : "Offline"}
          tone={connected ? "pass" : "fail"}
        />
        <StatusCard
          label="Gate checklist"
          value={gateReady ? "Ready" : s?.gatesReady === false ? "Blocked" : "—"}
          tone={gateReady ? "pass" : s?.gatesReady === false ? "warn" : "neutral"}
        />
        <StatusCard label="Network" value={s?.network ?? "—"} />
        <StatusCard label="Audit rows" value={String(s?.auditCount ?? 0)} />
      </div>

      <section className="section">
        <h2>Deployment gates</h2>
        {gates.isLoading && <p className="muted">Loading gates…</p>}
        {gates.data && <GatesPanel gates={gates.data.gates} />}
      </section>

      <style>{`
        .page-header h1 { margin: 0 0 0.35rem; font-size: 1.75rem; }
        .page-header p { margin: 0 0 1.5rem; color: var(--muted); }
        .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .section h2 { font-size: 1rem; margin: 0 0 1rem; }
        .banner { padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 1rem; }
        .banner.fail { background: rgba(231,111,111,0.15); color: var(--fail); }
        .muted { color: var(--muted); }
      `}</style>
    </div>
  );
}
