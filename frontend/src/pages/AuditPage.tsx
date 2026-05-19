import { useAudit } from "@/hooks/useSettlementApi";

export function AuditPage() {
  const audit = useAudit();

  return (
    <div>
      <header className="page-header">
        <h1>Audit trail</h1>
        <p>Settlement records from <code className="mono">GET /audit</code>.</p>
      </header>

      {audit.isLoading && <p className="muted">Loading…</p>}
      {audit.isError && (
        <p className="err">{audit.error instanceof Error ? audit.error.message : "Failed"}</p>
      )}

      {audit.data && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Execution</th>
                <th>Contract</th>
                <th>Tx</th>
                <th>Gas</th>
                <th>Depth</th>
                <th>Archived</th>
              </tr>
            </thead>
            <tbody>
              {audit.data.records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    No audit rows yet — run a settlement from Operations.
                  </td>
                </tr>
              ) : (
                audit.data.records.map((r) => (
                  <tr key={`${r.executionId}-${r.archivedAt}`}>
                    <td className="mono truncate">{r.executionId.slice(0, 18)}…</td>
                    <td className="mono truncate">{r.contractId.slice(0, 18)}…</td>
                    <td className="mono truncate">{r.txHash.slice(0, 18)}…</td>
                    <td>{String(r.gasUsed)}</td>
                    <td>{r.confirmationDepth}</td>
                    <td>{new Date(r.archivedAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .page-header h1 { margin: 0 0 0.35rem; }
        .page-header p { color: var(--muted); margin: 0 0 1.5rem; }
        .table-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        th, td { padding: 0.65rem 0.75rem; border-bottom: 1px solid var(--border); text-align: left; }
        th { color: var(--muted); font-size: 0.7rem; text-transform: uppercase; }
        .truncate { max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .empty { color: var(--muted); text-align: center; padding: 2rem !important; }
        .muted, .err { color: var(--muted); }
        .err { color: var(--fail); }
      `}</style>
    </div>
  );
}
