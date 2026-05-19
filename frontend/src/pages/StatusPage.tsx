import { useQuery } from "@tanstack/react-query";
import { loadClientConfig, settlementClient } from "@/api/settlementClient";

export function StatusPage() {
  const config = loadClientConfig();

  const health = useQuery({
    queryKey: ["status-health", config.baseUrl],
    queryFn: () => settlementClient.health(config),
  });
  const gates = useQuery({
    queryKey: ["status-gates", config.baseUrl],
    queryFn: () => settlementClient.gates(config),
  });
  const audit = useQuery({
    queryKey: ["status-audit", config.baseUrl],
    queryFn: () => settlementClient.audit(config),
  });

  const checks = [
    {
      name: "Frontend loaded",
      ok: true,
      detail: window.location.origin,
    },
    {
      name: "Backend /health",
      ok: health.data?.ok === true,
      detail: health.isError
        ? health.error instanceof Error
          ? health.error.message
          : "failed"
        : health.data
          ? JSON.stringify(health.data)
          : "loading…",
    },
    {
      name: "Backend /v1/gates",
      ok: gates.isSuccess,
      detail: gates.data ? `ready=${gates.data.ready} network=${gates.data.network}` : "loading…",
    },
    {
      name: "Backend /audit",
      ok: audit.isSuccess,
      detail: audit.data ? `${audit.data.records.length} records` : "loading…",
    },
  ];

  const allOk = checks.every((c) => c.ok);

  return (
    <div>
      <header className="page-header">
        <h1>HTTPS stack status</h1>
        <p>Live checks against the settlement API through the Vite proxy.</p>
      </header>

      <div className={`banner ${allOk ? "pass" : "pending"}`}>
        {allOk ? "All systems operational" : "Waiting for backend or API key…"}
      </div>

      <ul className="checks">
        {checks.map((c) => (
          <li key={c.name} className={c.ok ? "ok" : "bad"}>
            <span className="dot" />
            <div>
              <strong>{c.name}</strong>
              <p>{c.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      <section className="links">
        <h2>Direct links</h2>
        <p>
          Dashboard: <a href="/">/</a>
        </p>
        <p>
          Health JSON:{" "}
          <a href={`${config.baseUrl}/health`} target="_blank" rel="noreferrer">
            {config.baseUrl}/health
          </a>
        </p>
      </section>

      <style>{`
        .page-header h1 { margin: 0 0 0.35rem; }
        .page-header p { color: var(--muted); margin: 0 0 1rem; }
        .banner {
          padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 1.25rem; font-weight: 600;
        }
        .banner.pass { background: rgba(82,183,136,0.15); color: var(--pass); }
        .banner.pending { background: rgba(244,162,97,0.15); color: var(--warn); }
        .checks { list-style: none; padding: 0; margin: 0 0 2rem; }
        .checks li {
          display: flex; gap: 0.75rem; align-items: flex-start;
          padding: 0.75rem 0; border-bottom: 1px solid var(--border);
        }
        .dot {
          width: 10px; height: 10px; border-radius: 50%; margin-top: 0.35rem; flex-shrink: 0;
          background: var(--fail);
        }
        .ok .dot { background: var(--pass); }
        .checks p { margin: 0.25rem 0 0; color: var(--muted); font-size: 0.85rem; word-break: break-all; }
        .links h2 { font-size: 1rem; }
      `}</style>
    </div>
  );
}
