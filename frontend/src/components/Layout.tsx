import { NavLink, Outlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, FileText, Activity, Zap, Settings, ChevronRight } from "lucide-react";
import { SettingsPanel } from "./SettingsPanel";
import { useState } from "react";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/audit", label: "Audit Trail", icon: FileText, end: false },
  { to: "/status", label: "System Status", icon: Activity, end: false },
  { to: "/operations", label: "Operations", icon: Zap, end: false },
];

export function Layout() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)", position: "relative", overflow: "hidden" }}>
      <BackgroundFx />

      <aside style={{
        width: 240,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "rgba(8,14,26,0.85)",
        borderRight: "1px solid var(--border)",
        backdropFilter: "blur(20px)",
        padding: "24px 12px",
        gap: 8,
        position: "relative",
        zIndex: 10,
        flexShrink: 0,
      }}>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 8px 24px", borderBottom: "1px solid var(--border)" }}
        >
          <div style={{ position: "relative" }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-blue) 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 20px var(--accent-glow), 0 0 40px var(--accent-glow)",
            }}>
              <Zap size={18} color="#050912" strokeWidth={2.5} />
            </div>
            <motion.div
              animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              style={{
                position: "absolute", inset: -4, borderRadius: 16,
                border: "1px solid var(--accent)", pointerEvents: "none",
              }}
            />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", letterSpacing: "-0.01em", color: "var(--text)" }}>
              Sui Energy
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Settlement Layer
            </div>
          </div>
        </motion.div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, paddingTop: 8 }}>
          {nav.map((item, i) => (
            <motion.div
              key={item.to}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <NavLink
                to={item.to}
                end={item.end}
                style={({ isActive }) => ({
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 10,
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  background: isActive ? "var(--accent-glow)" : "transparent",
                  border: isActive ? "1px solid rgba(0,229,212,0.2)" : "1px solid transparent",
                  fontWeight: isActive ? 600 : 400,
                  fontSize: "0.875rem",
                  transition: "all var(--transition)",
                  textDecoration: "none",
                })}
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {isActive && <ChevronRight size={14} style={{ opacity: 0.5 }} />}
                  </>
                )}
              </NavLink>
            </motion.div>
          ))}
        </nav>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <motion.button
            onClick={() => setSettingsOpen(v => !v)}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", padding: "9px 12px", borderRadius: 10,
              background: settingsOpen ? "var(--surface-2)" : "transparent",
              border: "1px solid transparent",
              color: "var(--text-secondary)", fontSize: "0.875rem",
              cursor: "pointer", transition: "all var(--transition)",
            }}
          >
            <Settings size={16} />
            <span>API Settings</span>
          </motion.button>
          <AnimatePresence>
            {settingsOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: "hidden" }}
              >
                <div style={{ paddingTop: 12 }}>
                  <SettingsPanel />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>

      <main style={{
        flex: 1, padding: "32px 36px",
        overflowY: "auto", position: "relative", zIndex: 10,
        maxWidth: "calc(100vw - 240px)",
      }}>
        <Outlet />
      </main>
    </div>
  );
}

function BackgroundFx() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      <motion.div
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute", top: "-20%", left: "-10%",
          width: "60%", height: "60%",
          background: "radial-gradient(ellipse, rgba(0,229,212,0.07) 0%, transparent 70%)",
          borderRadius: "50%",
        }}
      />
      <motion.div
        animate={{ opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        style={{
          position: "absolute", bottom: "-20%", right: "-10%",
          width: "50%", height: "50%",
          background: "radial-gradient(ellipse, rgba(77,159,255,0.07) 0%, transparent 70%)",
          borderRadius: "50%",
        }}
      />
      <motion.div
        animate={{ opacity: [0.15, 0.3, 0.15] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 6 }}
        style={{
          position: "absolute", top: "40%", left: "40%",
          width: "40%", height: "40%",
          background: "radial-gradient(ellipse, rgba(167,139,250,0.05) 0%, transparent 70%)",
          borderRadius: "50%",
        }}
      />
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.03 }}>
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
}
