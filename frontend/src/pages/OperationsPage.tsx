import { useState } from "react";
import { useRedemptionDryRun, useSettlementProcess } from "@/hooks/useSettlementApi";

const HEX64 = "0x" + "11".repeat(32);

export function OperationsPage() {
  const dryRun = useRedemptionDryRun();
  const process = useSettlementProcess();

  const [consumer, setConsumer] = useState("0x" + "01".repeat(32));
  const [kwhClaim, setKwhClaim] = useState("1");

  return (
    <div>
      <header className="page-header">
        <h1>Operations</h1>
        <p>Pipeline actions against the settlement API (dry-run and process).</p>
      </header>

      <section className="card">
        <h2>Redemption dry-run</h2>
        <p className="hint">POST /v1/redemption/dry-run — validates PTB without submit.</p>
        <div className="form-row">
          <label>
            Consumer (0x)
            <input value={consumer} onChange={(e) => setConsumer(e.target.value)} className="mono" />
          </label>
          <label>
            kWh claim
            <input value={kwhClaim} onChange={(e) => setKwhClaim(e.target.value)} />
          </label>
        </div>
        <button
          type="button"
          className="btn primary"
          disabled={dryRun.isPending}
          onClick={() =>
            dryRun.mutate({
              consumer,
              kwhClaim,
              coinBalanceMicro: "1000000",
              batchKwh: kwhClaim,
              batchRedeemed: false,
            })
          }
        >
          {dryRun.isPending ? "Running…" : "Run dry-run"}
        </button>
        {dryRun.isSuccess && (
          <pre className="result pass">
            {JSON.stringify(dryRun.data.dryRun, null, 2)}
          </pre>
        )}
        {dryRun.isError && (
          <pre className="result fail">
            {dryRun.error instanceof Error ? dryRun.error.message : "Failed"}
          </pre>
        )}
      </section>

      <section className="card">
        <h2>Settlement process</h2>
        <p className="hint">POST /v1/settlement/process — appends audit row (stub on-chain).</p>
        <button
          type="button"
          className="btn primary"
          disabled={process.isPending}
          onClick={() =>
            process.mutate({
              contractId: HEX64,
              executionId: "0x" + "22".repeat(32),
              txHash: "0x" + "33".repeat(32),
              executionBlock: 1,
              confirmationBlock: 3,
              settled: true,
              rollbackReason: "0x" + "0".repeat(64),
              gasUsed: "50000",
              options: { consumer, kwhClaim },
            })
          }
        >
          {process.isPending ? "Processing…" : "Process settlement"}
        </button>
        {process.isSuccess && (
          <pre className="result pass">{JSON.stringify(process.data, null, 2)}</pre>
        )}
        {process.isError && (
          <pre className="result fail">
            {process.error instanceof Error ? process.error.message : "Failed"}
          </pre>
        )}
      </section>

      <style>{`
        .page-header h1 { margin: 0 0 0.35rem; }
        .page-header p { color: var(--muted); margin: 0 0 1.5rem; }
        .card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 12px; padding: 1.25rem; margin-bottom: 1.25rem;
        }
        .card h2 { margin: 0 0 0.35rem; font-size: 1.1rem; }
        .hint { color: var(--muted); font-size: 0.85rem; margin: 0 0 1rem; }
        .form-row { display: grid; grid-template-columns: 1fr auto; gap: 1rem; margin-bottom: 1rem; }
        label { display: block; font-size: 0.8rem; color: var(--muted); }
        input {
          display: block; width: 100%; margin-top: 0.25rem; padding: 0.5rem;
          background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text);
        }
        .btn {
          padding: 0.55rem 1.25rem; border: none; border-radius: 8px; font-weight: 600;
        }
        .btn.primary { background: var(--accent-dim); color: #fff; }
        .btn.primary:hover:not(:disabled) { background: var(--accent); }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .result {
          margin-top: 1rem; padding: 0.75rem; border-radius: 8px; font-size: 0.8rem; overflow-x: auto;
        }
        .result.pass { background: rgba(82,183,136,0.12); border: 1px solid var(--pass); }
        .result.fail { background: rgba(231,111,111,0.12); border: 1px solid var(--fail); }
      `}</style>
    </div>
  );
}
