import { motion } from "framer-motion";
import type { ReactNode } from "react";

const toneColors = {
  neutral: { glow: "transparent", border: "var(--border)", text: "var(--text)" },
  pass: { glow: "var(--pass-glow)", border: "rgba(52,211,153,0.25)", text: "var(--pass)" },
  fail: { glow: "var(--fail-glow)", border: "rgba(255,107,122,0.25)", text: "var(--fail)" },
  warn: { glow: "var(--warn-glow)", border: "rgba(245,166,35,0.25)", text: "var(--warn)" },
};

export function StatusCard({
  label,
  value,
  tone = "neutral",
  icon,
  subtitle,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "pass" | "fail" | "warn";
  icon?: ReactNode;
  subtitle?: string;
}) {
  const colors = toneColors[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.3 }}
      style={{
        background: "var(--surface)",
        border: `1px solid ${colors.border}`,
        borderRadius: "var(--radius)",
        padding: "20px 22px",
        backdropFilter: "blur(12px)",
        boxShadow: tone !== "neutral" ? `0 0 30px ${colors.glow}, inset 0 0 20px ${colors.glow}` : "none",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {tone !== "neutral" && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${colors.text}, transparent)`,
          opacity: 0.6,
        }} />
      )}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase" }}>
          {label}
        </span>
        {icon && (
          <div style={{ color: colors.text, opacity: 0.7 }}>{icon}</div>
        )}
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: colors.text, letterSpacing: "-0.02em", lineHeight: 1 }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 6 }}>{subtitle}</div>
      )}
    </motion.div>
  );
}
