import { motion } from "framer-motion";
import { Activity, Network, Shield, Database, Zap, TrendingUp } from "lucide-react";
import { GatesPanel } from "@/components/GatesPanel";
import { StatusCard } from "@/components/StatusCard";
import { useGates, usePipelineStatus } from "@/hooks/useSettlementApi";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export function DashboardPage() {
  const status = usePipelineStatus();
  const gates = useGates();

  const s = status.data;
  const connected = s?.health?.ok === true;
  const gateReady = s?.gatesReady === true;

  return (
    <motion.div initial="initial" animate="animate" variants={{ animate: { transition: { staggerChildren: 0.08 } } }}>
      <motion.div variants={fadeUp} style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: "linear-gradient(135deg, var(--accent), var(--accent-blue))",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 16px var(--accent-glow)",
          }}>
            <TrendingUp size={16} color="#050912" strokeWidth={2.5} />
          </div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text)" }}>
            Overview
          </h1>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Real-time settlement pipeline health across all layers.
        </p>
      </motion.div>

      {!connected && !status.isLoading && (
        <motion.div
          variants={fadeUp}
          style={{
            padding: "12px 16px", borderRadius: 10, marginBottom: 20,
            background: "rgba(255,107,122,0.08)", border: "1px solid rgba(255,107,122,0.25)",
            color: "var(--text-secondary)", fontSize: "0.83rem", display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <Activity size={14} color="var(--fail)" style={{ flexShrink: 0 }} />
          <span>
            Settlement API is <strong style={{ color: "var(--fail)" }}>offline</strong> — configure your API connection below, or start the backend with Docker.
          </span>
        </motion.div>
      )}

      <motion.div
        variants={fadeUp}
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 32 }}
      >
        <StatusCard
          label="Backend Health"
          value={connected ? "Online" : status.isLoading ? "Checking…" : "Offline"}
          tone={connected ? "pass" : status.isLoading ? "neutral" : "fail"}
          icon={<Activity size={15} />}
          subtitle={connected ? "All systems operational" : "Backend unreachable"}
        />
        <StatusCard
          label="Gate Checklist"
          value={gateReady ? "Ready" : s?.gatesReady === false ? "Blocked" : "—"}
          tone={gateReady ? "pass" : s?.gatesReady === false ? "warn" : "neutral"}
          icon={<Shield size={15} />}
          subtitle={gateReady ? "All gates cleared" : "Review gates below"}
        />
        <StatusCard
          label="Network"
          value={s?.network ?? "—"}
          icon={<Network size={15} />}
          subtitle="Sui blockchain network"
        />
        <StatusCard
          label="Audit Records"
          value={String(s?.auditCount ?? 0)}
          icon={<Database size={15} />}
          subtitle="Settled transactions"
        />
      </motion.div>

      <motion.div variants={fadeUp} style={{ marginBottom: 32 }}>
        <PipelineFlow />
      </motion.div>

      <motion.div variants={fadeUp}>
        <SectionHeader icon={<Shield size={14} />} title="Deployment Gates" subtitle="Pre-flight checks for going live" />
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: 16, backdropFilter: "blur(12px)",
        }}>
          {gates.isLoading && <LoadingDots label="Loading gates" />}
          {!gates.isLoading && !gates.data && (
            <div style={{ color: "var(--muted)", fontSize: "0.85rem", padding: "24px 0", textAlign: "center" }}>
              Backend offline — gates unavailable
            </div>
          )}
          {gates.data && <GatesPanel gates={gates.data.gates} />}
        </div>
      </motion.div>
    </motion.div>
  );
}

function PipelineFlow() {
  const layers = [
    { id: "L2", label: "Device Layer", desc: "Registry & Attestation", color: "var(--accent-purple)" },
    { id: "L3", label: "Token Layer", desc: "Energy Minting", color: "var(--accent)" },
    { id: "L4", label: "Compliance", desc: "EVM Bridge", color: "var(--accent-blue)" },
    { id: "L5", label: "Settlement", desc: "USDC & Carbon", color: "var(--pass)" },
  ];

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", padding: "20px 24px", backdropFilter: "blur(12px)",
    }}>
      <SectionHeader icon={<Zap size={14} />} title="Energy Pipeline" subtitle="L2 → L3 → L4 → L5 settlement flow" />
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 16, overflowX: "auto" }}>
        {layers.map((layer, i) => (
          <div key={layer.id} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 120 }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              style={{
                flex: 1, padding: "14px 12px", borderRadius: 10, textAlign: "center",
                background: `${layer.color}10`,
                border: `1px solid ${layer.color}30`,
                position: "relative",
              }}
            >
              <div style={{
                fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em",
                color: layer.color, marginBottom: 4,
              }}>
                {layer.id}
              </div>
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                {layer.label}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{layer.desc}</div>
              <motion.div
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
                style={{
                  position: "absolute", inset: -1, borderRadius: 10,
                  border: `1px solid ${layer.color}`,
                  pointerEvents: "none",
                }}
              />
            </motion.div>
            {i < layers.length - 1 && (
              <div style={{ flexShrink: 0, width: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FlowArrow />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowArrow() {
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" fill="none">
      <motion.path
        d="M 0 8 L 16 8 M 10 3 L 16 8 L 10 13"
        stroke="var(--border-bright)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        animate={{ opacity: [0.3, 0.9, 0.3] }}
        transition={{ duration: 1.8, repeat: Infinity }}
      />
    </svg>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <div style={{ color: "var(--accent)", opacity: 0.8 }}>{icon}</div>
      <div>
        <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text)" }}>{title}</div>
        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>{subtitle}</div>
      </div>
    </div>
  );
}

function LoadingDots({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 0", color: "var(--muted)", fontSize: "0.85rem" }}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1, 0.8] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
          style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)" }}
        />
      ))}
      {label}
    </div>
  );
}
