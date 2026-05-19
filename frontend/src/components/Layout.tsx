import { NavLink, Outlet } from "react-router-dom";
import { SettingsPanel } from "./SettingsPanel";

const nav = [
  { to: "/", label: "Dashboard" },
  { to: "/audit", label: "Audit" },
  { to: "/status", label: "Status" },
  { to: "/operations", label: "Operations" },
];

export function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" />
          <div>
            <strong>Sui Energy</strong>
            <small>Settlement</small>
          </div>
        </div>
        <nav>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <SettingsPanel />
      </aside>
      <main className="main">
        <Outlet />
      </main>
      <style>{`
        .app-shell { display: flex; min-height: 100vh; }
        .sidebar {
          width: 260px; padding: 1.5rem 1rem; border-right: 1px solid var(--border);
          background: var(--surface); display: flex; flex-direction: column; gap: 1.5rem;
        }
        .brand { display: flex; align-items: center; gap: 0.75rem; }
        .brand-mark {
          width: 36px; height: 36px; border-radius: 10px;
          background: linear-gradient(135deg, var(--accent), #1d6ea8);
        }
        .brand strong { display: block; font-size: 1rem; }
        .brand small { color: var(--muted); font-size: 0.75rem; }
        nav { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; }
        .nav-link {
          padding: 0.55rem 0.75rem; border-radius: 8px; color: var(--muted);
        }
        .nav-link.active, .nav-link:hover {
          background: var(--surface-2); color: var(--text); text-decoration: none;
        }
        .main { flex: 1; padding: 2rem; max-width: 1100px; }
      `}</style>
    </div>
  );
}
