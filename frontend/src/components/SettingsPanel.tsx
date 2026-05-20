import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Link, Key } from "lucide-react";
import { loadClientConfig, saveClientConfig } from "@/api/settlementClient";

export function SettingsPanel() {
  const initial = loadClientConfig();
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [saved, setSaved] = useState(false);

  function onSave() {
    saveClientConfig({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim() });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      window.location.reload();
    }, 1200);
  }

  const inputStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 8,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "7px 10px",
    marginTop: 5,
    width: "100%",
    color: "var(--text)",
    fontSize: "0.78rem",
    outline: "none",
    fontFamily: "var(--mono)",
    transition: "border-color var(--transition)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label style={{ display: "block" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.7rem", color: "var(--text-secondary)", marginBottom: 2 }}>
          <Link size={11} /> Base URL
        </div>
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="/settlement-api"
          style={inputStyle}
          onFocus={e => (e.currentTarget.style.borderColor = "rgba(0,229,212,0.4)")}
          onBlur={e => (e.currentTarget.style.borderColor = "var(--border)")}
        />
      </label>
      <label style={{ display: "block" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.7rem", color: "var(--text-secondary)", marginBottom: 2 }}>
          <Key size={11} /> API Key
        </div>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="••••••••"
          style={inputStyle}
          onFocus={e => (e.currentTarget.style.borderColor = "rgba(0,229,212,0.4)")}
          onBlur={e => (e.currentTarget.style.borderColor = "var(--border)")}
        />
      </label>
      <motion.button
        onClick={onSave}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        style={{
          padding: "8px 12px", border: "none", borderRadius: 8,
          background: saved ? "var(--pass-glow)" : "linear-gradient(135deg, var(--accent), var(--accent-blue))",
          color: saved ? "var(--pass)" : "#050912",
          fontWeight: 600, fontSize: "0.78rem",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          transition: "all var(--transition)",
          cursor: "pointer",
        }}
      >
        {saved ? <><Check size={13} /> Saved!</> : "Save & reconnect"}
      </motion.button>
    </div>
  );
}
