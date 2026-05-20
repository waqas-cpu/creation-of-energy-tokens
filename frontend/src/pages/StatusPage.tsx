import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, CheckCircle, XCircle, Loader, ExternalLink, Wifi } from "lucide-react";
import { loadClientConfig, settlementClient } from "@/api/settlementClient";

export function StatusPage() {
  const config = loadClientConfig();

  const health = useQuery({ queryKey: ["status-health", config.baseUrl], queryFn: () => settlementClient.health(config) });
  const gates = useQuery({ queryKey: ["status-gates", config.baseUrl], queryFn: () => settlementClient.gates(config) });
  const audit = useQuery({ queryKey: ["status-audit", config.baseUrl], queryFn: () => settlementClient.audit(config) });

  const checks = [
    {
      name: "Frontend",
      description: "React application loaded",
      ok: true,
      loading: false,
      detail: window.location.origin,
      category: "Core",
    },
    {
      name: "Backend Health",
      description: "/health endpoint reachable",
      ok: health.data?.ok === true,
      loading: health.isLoading,
      detail: health.isError
        ? health.error instanceof Error ? health.error.message : "Failed"
        : health.data ? JSON.stringify(health.data) : "Checking…",
      category: "API",
    },
    {
      name: "Gate Checklist",
      description: "/v1/gates deployment readiness",
      ok: gates.isSuccess,
      loading: gates.isLoading,
      detail: gates.data ? `Ready: ${gates.data.ready} · Network: ${gates.data.network}` : gates.isLoading ? "Checking…" : "Unreachable",
      category: "API",
    },
    {
      name: "Audit Endpoint",
      description: "/audit settlement records",
      ok: audit.isSuccess,
      loading: audit.isLoading,
      detail: audit.data ? `${audit.data.records.length} records available` : audit.isLoading ? "Checking…" : "Unreachable",
      category: "API",
    },
  ];

  const allOk = checks.every(c => c.ok);
  const passCount = checks.filter(c => c.ok).length;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: allOk ? "linear-gradient(135deg, var(--pass), #059669)" : "linear-gradient(135deg, var(--warn), #d97706)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: allOk ? "0 0 16px var(--pass-glow)" : "0 0 16px var(--warn-glow)",
          }}>
            <Activity size={16} color="#050912" strokeWidth={2.5} />
          </div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, letterSpacing: "-0.03em" }}>System Status</h1>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          Live connectivity checks across all endpoints.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        style={{
          padding: "18px 22px", borderRadius: "var(--radius)", marginBottom: 24,
          background: allOk ? "var(--pass-glow)" : "var(--warn-glow)",
          border: `1px solid ${allOk ? "rgba(52,211,153,0.3)" : "rgba(245,166,35,0.3)"}`,
          display: "flex", alignItems: "center", gap: 12,
        }}
      >
        <div style={{ position: "relative" }}>
          <Wifi size={18} color={allOk ? "var(--pass)" : "var(--warn)"} />
          {!allOk && (
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0, 0.8] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                position: "absolute", inset: -4, borderRadius: "50%",
                border: `1px solid var(--warn)`,
              }}
            />
          )}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.9rem", color: allOk ? "var(--pass)" : "var(--warn)" }}>
            {allOk ? "All systems operational" : "Partial connectivity"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 2 }}>
            {passCount} of {checks.length} checks passing
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {checks.map((c, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.1 + 0.2 }}
              style={{
                width: 8, height: 8, borderRadius: "50%",
                background: c.loading ? "var(--muted)" : c.ok ? "var(--pass)" : "var(--fail)",
              }}
            />
          ))}
        </div>
      </motion.div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        {checks.map((check, i) => (
          <motion.div
            key={check.name}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07 + 0.15 }}
            style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "14px 18px", borderRadius: 10,
              background: "var(--surface)", border: "1px solid var(--border)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div style={{ flexShrink: 0 }}>
              {check.loading
                ? <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader size={16} color="var(--muted)" /></motion.span>
                : check.ok
                  ? <CheckCircle size={16} color="var(--pass)" />
                  : <XCircle size={16} color="var(--fail)" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: "0.87rem", fontWeight: 600, color: "var(--text)" }}>{check.name}</span>
                <span style={{
                  fontSize: "0.62rem", fontWeight: 600, letterSpacing: "0.07em",
                  color: "var(--text-secondary)", padding: "1px 6px", borderRadius: 4,
                  background: "var(--surface-2)", border: "1px solid var(--border)",
                }}>
                  {check.category}
                </span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 3 }}>{check.description}</div>
              <div style={{
                fontFamily: "var(--mono)", fontSize: "0.7rem", color: "var(--muted)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {check.detail}
              </div>
            </div>
            <div style={{
              flexShrink: 0, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em",
              color: check.loading ? "var(--muted)" : check.ok ? "var(--pass)" : "var(--fail)",
              padding: "3px 9px", borderRadius: 6,
              background: check.loading ? "rgba(255,255,255,0.04)" : check.ok ? "var(--pass-glow)" : "var(--fail-glow)",
              border: `1px solid ${check.loading ? "var(--border)" : check.ok ? "rgba(52,211,153,0.25)" : "rgba(255,107,122,0.25)"}`,
            }}>
              {check.loading ? "CHECKING" : check.ok ? "ONLINE" : "OFFLINE"}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "18px 22px", backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Quick Links
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { label: "Dashboard", href: "/" },
            { label: "Health JSON", href: `${config.baseUrl}/health` },
          ].map(link => (
            <a
              key={link.label}
              href={link.href}
              target={link.href.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: "0.83rem", color: "var(--accent)",
                padding: "6px 0",
              }}
            >
              <ExternalLink size={12} />
              {link.label}
              <span style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", color: "var(--muted)", marginLeft: 4 }}>
                {link.href}
              </span>
            </a>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
