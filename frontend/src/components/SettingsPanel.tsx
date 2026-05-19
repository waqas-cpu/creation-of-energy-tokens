import { useState } from "react";
import { loadClientConfig, saveClientConfig } from "@/api/settlementClient";

export function SettingsPanel() {
  const initial = loadClientConfig();
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [saved, setSaved] = useState(false);

  function onSave() {
    saveClientConfig({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    window.location.reload();
  }

  return (
    <div className="settings">
      <h3>API connection</h3>
      <label>
        Base URL
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="/settlement-api"
        />
      </label>
      <label>
        API key
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="SETTLEMENT_API_KEY"
        />
      </label>
      <button type="button" className="btn" onClick={onSave}>
        {saved ? "Saved" : "Save & reconnect"}
      </button>
      <style>{`
        .settings h3 { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 0 0 0.75rem; }
        .settings label { display: block; font-size: 0.8rem; color: var(--muted); margin-bottom: 0.75rem; }
        .settings input {
          display: block; width: 100%; margin-top: 0.25rem; padding: 0.45rem 0.5rem;
          background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text);
        }
        .btn {
          width: 100%; padding: 0.5rem; border: none; border-radius: 8px;
          background: var(--accent-dim); color: #fff; font-weight: 600;
        }
        .btn:hover { background: var(--accent); }
      `}</style>
    </div>
  );
}
