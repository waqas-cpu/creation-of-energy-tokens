import { motion } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, SkipForward } from "lucide-react";
import type { GateItem } from "@/api/types";

const statusConfig = {
  pass: { color: "var(--pass)", bg: "var(--pass-glow)", border: "rgba(52,211,153,0.25)", Icon: CheckCircle, label: "PASS" },
  fail: { color: "var(--fail)", bg: "var(--fail-glow)", border: "rgba(255,107,122,0.25)", Icon: XCircle, label: "FAIL" },
  warn: { color: "var(--warn)", bg: "var(--warn-glow)", border: "rgba(245,166,35,0.25)", Icon: AlertTriangle, label: "WARN" },
  skip: { color: "var(--muted)", bg: "rgba(255,255,255,0.03)", border: "var(--border)", Icon: SkipForward, label: "SKIP" },
};

export function GatesPanel({ gates }: { gates: GateItem[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {gates.map((g, i) => {
        const cfg = statusConfig[g.status as keyof typeof statusConfig] ?? statusConfig.skip;
        const { Icon } = cfg;
        return (
          <motion.div
            key={g.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "12px 16px", borderRadius: 10,
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              backdropFilter: "blur(8px)",
              transition: "all var(--transition)",
            }}
          >
            <Icon size={16} color={cfg.color} strokeWidth={2} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", color: "var(--muted)" }}>{g.id}</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text)" }}>{g.name}</span>
              </div>
              {g.detail && (
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {g.detail}
                </div>
              )}
            </div>
            <span style={{
              fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em",
              color: cfg.color, padding: "3px 8px", borderRadius: 6,
              background: `${cfg.color}15`, border: `1px solid ${cfg.color}30`,
              flexShrink: 0,
            }}>
              {cfg.label}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
