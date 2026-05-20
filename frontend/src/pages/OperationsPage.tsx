import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Play, CheckCircle, XCircle, ChevronDown, ChevronUp, Loader } from "lucide-react";
import { useRedemptionDryRun, useSettlementProcess } from "@/hooks/useSettlementApi";

const HEX64 = "0x" + "11".repeat(32);

export function OperationsPage() {
  const dryRun = useRedemptionDryRun();
  const process = useSettlementProcess();
  const [consumer, setConsumer] = useState("0x" + "01".repeat(32));
  const [kwhClaim, setKwhClaim] = useState("1");
  const [dryRunExpanded, setDryRunExpanded] = useState(false);
  const [processExpanded, setProcessExpanded] = useState(false);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: "linear-gradient(135deg, var(--warn), #ff8c42)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 16px var(--warn-glow)",
          }}>
            <Zap size={16} color="#050912" strokeWidth={2.5} />
          </div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, letterSpacing: "-0.03em" }}>Operations</h1>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          Manually trigger settlement pipeline actions against the API.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <OperationCard
          title="Redemption Dry-Run"
          badge="VALIDATE"
          badgeColor="var(--accent)"
          description="Validates a Programmable Transaction Block without submitting to chain."
          icon={<Play size={14} />}
          status={dryRun.isPending ? "loading" : dryRun.isSuccess ? "success" : dryRun.isError ? "error" : "idle"}
          onRun={() => dryRun.mutate({ consumer, kwhClaim, coinBalanceMicro: "1000000", batchKwh: kwhClaim, batchRedeemed: false })}
          resultExpanded={dryRunExpanded}
          onToggleResult={() => setDryRunExpanded(v => !v)}
          result={dryRun.isSuccess ? JSON.stringify(dryRun.data.dryRun, null, 2) : dryRun.isError ? (dryRun.error instanceof Error ? dryRun.error.message : "Failed") : null}
          resultTone={dryRun.isSuccess ? "pass" : "fail"}
          buttonLabel={dryRun.isPending ? "Validating…" : "Run Dry-Run"}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 12 }}>
            <Field label="Consumer Address" value={consumer} onChange={setConsumer} monospace />
            <Field label="kWh Claim" value={kwhClaim} onChange={setKwhClaim} />
          </div>
        </OperationCard>

        <OperationCard
          title="Settlement Process"
          badge="EXECUTE"
          badgeColor="var(--pass)"
          description="Appends an audit row and stubs the on-chain settlement execution."
          icon={<CheckCircle size={14} />}
          status={process.isPending ? "loading" : process.isSuccess ? "success" : process.isError ? "error" : "idle"}
          onRun={() => process.mutate({
            contractId: HEX64,
            executionId: "0x" + "22".repeat(32),
            txHash: "0x" + "33".repeat(32),
            executionBlock: 1, confirmationBlock: 3, settled: true,
            rollbackReason: "0x" + "0".repeat(64), gasUsed: "50000",
            options: { consumer, kwhClaim },
          })}
          resultExpanded={processExpanded}
          onToggleResult={() => setProcessExpanded(v => !v)}
          result={process.isSuccess ? JSON.stringify(process.data, null, 2) : process.isError ? (process.error instanceof Error ? process.error.message : "Failed") : null}
          resultTone={process.isSuccess ? "pass" : "fail"}
          buttonLabel={process.isPending ? "Processing…" : "Process Settlement"}
        />
      </div>
    </motion.div>
  );
}

function Field({ label, value, onChange, monospace }: { label: string; value: string; onChange: (v: string) => void; monospace?: boolean }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: "0.72rem", fontWeight: 500, letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase" }}>
        {label}
      </div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          display: "block", width: "100%",
          padding: "9px 12px", borderRadius: 8,
          background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)",
          color: "var(--text)", fontSize: monospace ? "0.72rem" : "0.85rem",
          fontFamily: monospace ? "var(--mono)" : "var(--font)",
          outline: "none", transition: "border-color var(--transition)",
        }}
        onFocus={e => (e.currentTarget.style.borderColor = "rgba(0,229,212,0.4)")}
        onBlur={e => (e.currentTarget.style.borderColor = "var(--border)")}
      />
    </label>
  );
}

function OperationCard({
  title, badge, badgeColor, description, icon, status, onRun, children,
  result, resultTone, resultExpanded, onToggleResult, buttonLabel,
}: {
  title: string; badge: string; badgeColor: string; description: string;
  icon: React.ReactNode; status: "idle" | "loading" | "success" | "error";
  onRun: () => void; children?: React.ReactNode;
  result: string | null; resultTone: "pass" | "fail";
  resultExpanded: boolean; onToggleResult: () => void;
  buttonLabel: string;
}) {
  const hasResult = result !== null;

  return (
    <motion.div
      layout
      style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", backdropFilter: "blur(12px)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ color: badgeColor }}>{icon}</div>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)" }}>{title}</h2>
            <span style={{
              fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em",
              color: badgeColor, padding: "2px 7px", borderRadius: 5,
              background: `${badgeColor}15`, border: `1px solid ${badgeColor}30`,
            }}>
              {badge}
            </span>
          </div>
          {hasResult && (
            <StatusBadge tone={resultTone} />
          )}
        </div>
        <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: children ? 16 : 0 }}>
          {description}
        </p>
        {children && <div style={{ marginBottom: 16 }}>{children}</div>}
        <motion.button
          onClick={onRun}
          disabled={status === "loading"}
          whileHover={{ scale: status === "loading" ? 1 : 1.02 }}
          whileTap={{ scale: status === "loading" ? 1 : 0.97 }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "9px 18px", borderRadius: 9, border: "none",
            background: status === "loading"
              ? "rgba(255,255,255,0.06)"
              : `linear-gradient(135deg, ${badgeColor}cc, ${badgeColor}88)`,
            color: status === "loading" ? "var(--muted)" : "#050912",
            fontWeight: 600, fontSize: "0.85rem", cursor: status === "loading" ? "not-allowed" : "pointer",
            boxShadow: status === "loading" ? "none" : `0 0 20px ${badgeColor}30`,
            transition: "all var(--transition)",
          }}
        >
          {status === "loading"
            ? <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader size={14} /></motion.span>
            : icon}
          {buttonLabel}
        </motion.button>
      </div>

      <AnimatePresence>
        {hasResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              borderTop: `1px solid ${resultTone === "pass" ? "rgba(52,211,153,0.2)" : "rgba(255,107,122,0.2)"}`,
              background: resultTone === "pass" ? "var(--pass-glow)" : "var(--fail-glow)",
            }}>
              <button
                onClick={onToggleResult}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  width: "100%", padding: "10px 24px", background: "none", border: "none",
                  color: resultTone === "pass" ? "var(--pass)" : "var(--fail)",
                  fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
                }}
              >
                <span>{resultTone === "pass" ? "✓ Success" : "✗ Error"} — {resultExpanded ? "collapse" : "view result"}</span>
                {resultExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              <AnimatePresence>
                {resultExpanded && (
                  <motion.pre
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{
                      margin: 0, padding: "0 24px 16px",
                      fontFamily: "var(--mono)", fontSize: "0.75rem",
                      color: "var(--text-secondary)", overflow: "auto",
                      maxHeight: 240, lineHeight: 1.7,
                    }}
                  >
                    {result}
                  </motion.pre>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatusBadge({ tone }: { tone: "pass" | "fail" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      {tone === "pass"
        ? <CheckCircle size={14} color="var(--pass)" />
        : <XCircle size={14} color="var(--fail)" />}
      <span style={{ fontSize: "0.75rem", color: tone === "pass" ? "var(--pass)" : "var(--fail)", fontWeight: 500 }}>
        {tone === "pass" ? "Completed" : "Failed"}
      </span>
    </div>
  );
}
