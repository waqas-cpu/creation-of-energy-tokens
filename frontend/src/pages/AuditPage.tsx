import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Copy, Check, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useAudit } from "@/hooks/useSettlementApi";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      style={{
        background: "none", border: "none", cursor: "pointer",
        color: copied ? "var(--pass)" : "var(--muted)", padding: 2, borderRadius: 4,
        display: "inline-flex", alignItems: "center",
        transition: "color var(--transition)",
      }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </motion.button>
  );
}

function HashCell({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false);
  const short = value.slice(0, 10) + "…" + value.slice(-6);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span
        onClick={() => setExpanded(v => !v)}
        style={{
          fontFamily: "var(--mono)", fontSize: "0.75rem",
          color: "var(--text-secondary)", cursor: "pointer",
          background: "rgba(255,255,255,0.04)", padding: "2px 6px",
          borderRadius: 4, border: "1px solid var(--border)",
          maxWidth: expanded ? 260 : 130, overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap",
          transition: "max-width 0.3s",
        }}
        title={value}
      >
        {expanded ? value : short}
      </span>
      <CopyButton text={value} />
    </div>
  );
}

export function AuditPage() {
  const audit = useAudit();
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const records = audit.data?.records ?? [];
  const sorted = [...records].sort((a, b) => {
    const diff = new Date(a.archivedAt).getTime() - new Date(b.archivedAt).getTime();
    return sortDir === "desc" ? -diff : diff;
  });

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 16px rgba(167,139,250,0.2)",
            }}>
              <FileText size={16} color="#fff" strokeWidth={2} />
            </div>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 700, letterSpacing: "-0.03em" }}>Audit Trail</h1>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Immutable record of all settlement executions.
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => audit.refetch()}
          disabled={audit.isFetching}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "8px 14px", borderRadius: 9, border: "1px solid var(--border)",
            background: "var(--surface)", color: "var(--text-secondary)",
            fontSize: "0.8rem", cursor: "pointer",
          }}
        >
          <motion.span animate={audit.isFetching ? { rotate: 360 } : { rotate: 0 }} transition={{ duration: 1, repeat: audit.isFetching ? Infinity : 0, ease: "linear" }}>
            <RefreshCw size={13} />
          </motion.span>
          Refresh
        </motion.button>
      </div>

      {audit.isLoading && <LoadingState />}
      {audit.isError && <ErrorState message={audit.error instanceof Error ? audit.error.message : "Failed to load"} />}

      {audit.data && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", backdropFilter: "blur(12px)", overflow: "hidden",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 20px", borderBottom: "1px solid var(--border)",
          }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
              {records.length} {records.length === 1 ? "record" : "records"}
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {[
                    { key: "Execution ID", w: 160 },
                    { key: "Contract", w: 160 },
                    { key: "Tx Hash", w: 160 },
                    { key: "Gas Used", w: 90 },
                    { key: "Depth", w: 70 },
                    { key: "Archived", w: 150, sortable: true },
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={col.sortable ? () => setSortDir(d => d === "desc" ? "asc" : "desc") : undefined}
                      style={{
                        padding: "10px 16px", textAlign: "left",
                        fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.06em",
                        textTransform: "uppercase", color: "var(--text-secondary)",
                        borderBottom: "1px solid var(--border)", width: col.w,
                        cursor: col.sortable ? "pointer" : "default",
                        userSelect: "none",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {col.key}
                        {col.sortable && (sortDir === "desc" ? <ChevronDown size={11} /> : <ChevronUp size={11} />)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "48px 16px", textAlign: "center", color: "var(--muted)", fontSize: "0.85rem" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                          <FileText size={28} style={{ opacity: 0.3 }} />
                          No audit records yet — run a settlement from Operations.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sorted.map((r, i) => (
                      <motion.tr
                        key={`${r.executionId}-${r.archivedAt}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "11px 16px" }}><HashCell value={r.executionId} /></td>
                        <td style={{ padding: "11px 16px" }}><HashCell value={r.contractId} /></td>
                        <td style={{ padding: "11px 16px" }}><HashCell value={r.txHash} /></td>
                        <td style={{ padding: "11px 16px", color: "var(--text-secondary)", fontFamily: "var(--mono)", fontSize: "0.75rem" }}>
                          {Number(r.gasUsed).toLocaleString()}
                        </td>
                        <td style={{ padding: "11px 16px" }}>
                          <span style={{
                            background: "var(--accent-glow)", color: "var(--accent)",
                            padding: "2px 7px", borderRadius: 5, fontSize: "0.72rem", fontWeight: 600,
                          }}>{r.confirmationDepth}</span>
                        </td>
                        <td style={{ padding: "11px 16px", color: "var(--muted)", fontSize: "0.75rem" }}>
                          {new Date(r.archivedAt).toLocaleString()}
                        </td>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function LoadingState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[1, 2, 3, 4].map(i => (
        <motion.div
          key={i}
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.1 }}
          style={{
            height: 44, borderRadius: 10,
            background: "linear-gradient(90deg, var(--surface) 25%, var(--surface-2) 50%, var(--surface) 75%)",
            backgroundSize: "200% 100%",
          }}
        />
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div style={{
      padding: "20px 24px", borderRadius: "var(--radius)",
      background: "var(--fail-glow)", border: "1px solid rgba(255,107,122,0.3)",
      color: "var(--fail)", fontSize: "0.85rem",
    }}>
      {message}
    </div>
  );
}
