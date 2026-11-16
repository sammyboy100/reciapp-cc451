import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Icon, ReciLogo } from "./ui/Primitivos";

const LINKS = {
  ciudadano: [
    { path: "/ciudadano", label: "Inicio" },
    { path: "/ciudadano/solicitudes", label: "Mis solicitudes", corto: "Solicitudes" },
    { path: "/salas", label: "Salas" },
    { path: "/perfil", label: "Perfil" },
  ],
  reciclador: [
    { path: "/reciclador", label: "Solicitudes" },
    { path: "/salas", label: "Salas" },
    { path: "/perfil", label: "Perfil" },
  ],
  admin: [{ path: "/admin", label: "Panel" }, { path: "/admin/metricas", label: "Métricas" }],
};

export default function Navbar({ user = "Usuario", role = "ciudadano", onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const links = LINKS[role] || LINKS.ciudadano;
  const initial = (user || "U").charAt(0).toUpperCase();
  const roleLabel = role === "reciclador" ? "Reciclador" : role === "admin" ? "Administrador" : "Ciudadano";

  return (
    <header className="navbar" style={{ background: "var(--green)", boxShadow: "0 2px 0 var(--green-deep)", position: "sticky", top: 0, zIndex: 30 }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "12px clamp(16px, 4vw, 36px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <button type="button" className="nav-logo" aria-label="Ir al inicio" onClick={() => navigate(links[0].path)} style={{ display: "flex", alignItems: "center", gap: 11, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--green-deep)", display: "grid", placeItems: "center", boxShadow: "0 3px 0 oklch(0.45 0.12 143)" }}><ReciLogo size={25} /></div>
            <span className="nav-marca" style={{ fontFamily: "var(--serif)", fontSize: 24, color: "#fff", letterSpacing: 0.3 }}>Reci<span style={{ fontStyle: "italic" }}>App</span></span>
          </button>
          <nav aria-label="Principal" className="nav-links no-bar" style={{ display: "flex", gap: 4 }}>
            {links.map((l) => {
              const active = location.pathname === l.path || (l.path === "/salas" && location.pathname.startsWith("/salas"));
              return (
                <button key={l.path + l.label} type="button" aria-current={active ? "page" : undefined} onClick={() => navigate(l.path)} style={{
                  fontFamily: "var(--sans)", fontWeight: 600, fontSize: 14.5, cursor: "pointer", border: "none",
                  background: active ? "var(--green-deep)" : "transparent", color: "#fff",
                  padding: "8px 14px", borderRadius: 999, transition: "background .15s",
                }}><span className="largo">{l.label}</span><span className="corto">{l.corto || l.label}</span></button>
              );
            })}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" className="nav-avatar" aria-label="Mi perfil" onClick={() => navigate("/perfil")} style={{ display: "flex", alignItems: "center", gap: 9, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <span style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--cream)", color: "var(--green-deep)", display: "grid", placeItems: "center", fontFamily: "var(--serif)", fontSize: 17 }}>{initial}</span>
            <span className="nav-usuario" style={{ textAlign: "left", lineHeight: 1.1 }}>
              <span style={{ display: "block", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 14, color: "#fff" }}>{user}</span>
              <span style={{ display: "block", fontFamily: "var(--sans)", fontSize: 11.5, color: "#fff" }}>{roleLabel}</span>
            </span>
          </button>
          <button type="button" onClick={onLogout} title="Salir" style={{
            fontFamily: "var(--sans)", fontWeight: 600, fontSize: 14, color: "var(--green-deep)", background: "var(--cream)",
            border: "none", borderRadius: 999, padding: "9px 16px", cursor: "pointer", boxShadow: "0 3px 0 oklch(0.78 0.04 100)",
            display: "inline-flex", alignItems: "center", gap: 7,
          }}><Icon name="logout" size={16} stroke="var(--green-deep)" /><span className="nav-salir">Salir</span></button>
        </div>
      </div>
    </header>
  );
}
