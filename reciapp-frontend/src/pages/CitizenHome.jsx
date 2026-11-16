import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import NuevaSolicitudModal from "../components/NuevaSolicitud/NuevaSolicitudModal";
import { Icon, MapaPlaceholder, Starburst, MaterialCard } from "../components/ui/Primitivos";
import { MATERIALES, MAT, FRANJAS } from "../lib/datos";
import { usePerfil } from "../context/PerfilContext";
import CheckInEmocional from "../components/Emocion/CheckInEmocional";
import TarjetaImpacto from "../components/Emocion/TarjetaImpacto";
import ReciMascota from "../components/Reci/ReciMascota";

function DashCard({ badgeBg, icon, title, sub, accent, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ position: "relative", textAlign: "left", cursor: "pointer", width: "100%", background: "var(--cream-card)", border: "1.5px solid " + (hover ? (accent || "var(--green)") : "var(--line)"), borderRadius: 20, padding: "20px 20px 22px", display: "flex", flexDirection: "column", gap: 14, minHeight: 150, boxShadow: hover ? "0 12px 26px -16px oklch(0.3 0.04 130 / 0.55)" : "0 2px 0 oklch(0.88 0.03 120)", transform: hover ? "translateY(-3px)" : "none", transition: "transform .15s, box-shadow .15s, border-color .15s" }}>
      <span style={{ width: 46, height: 46, borderRadius: 13, background: badgeBg, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name={icon} size={22} stroke="#fff" /></span>
      <div style={{ marginTop: "auto" }}>
        <span style={{ fontFamily: "var(--serif)", fontSize: 21, color: "var(--ink)", lineHeight: 1.1, whiteSpace: "nowrap" }}>{title}</span>
        <p style={{ fontFamily: "var(--sans)", fontSize: 13.5, color: "var(--ink-soft)", margin: "5px 0 0" }}>{sub}</p>
      </div>
      <span style={{ position: "absolute", top: 22, right: 20, color: hover ? (accent || "var(--green)") : "var(--line)", transition: "color .15s, transform .15s", transform: hover ? "translateX(2px)" : "none" }}><Icon name="arrowRight" size={18} sw={2.2} /></span>
    </button>
  );
}

export default function CitizenHome() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [modal, setModal] = useState(false);
  const [inicial, setInicial] = useState(null);
  const { perfil } = usePerfil();
  const der = perfil.derivado || {};

  const nombre = user?.nombre?.split(" ")[0] || "ciudadano";

  const handleLogout = () => { logout(); navigate("/login", { replace: true }); };

  // El modal ya crea la solicitud; aquí solo navegamos (antes se duplicaba la creación)
  const handleCrearSolicitud = () => navigate("/ciudadano/solicitudes");
  const abrirModal = (ini = null) => { setInicial(ini); setModal(true); };

  // Saludo con tono adaptado a la emoción declarada o inferida (diseño emocional)
  const subtitulo = {
    frustracion: "Vamos con calma, hoy te lo hacemos más fácil.",
    cansancio: "Día largo, ¿no? Díselo a Reci y él se encarga.",
    tristeza: "Cada pequeño gesto cuenta. Gracias por estar aquí.",
    ansiedad: "Vamos directo: un toque y listo.",
    alegria: "¡Qué buena energía! ¿Qué reciclamos hoy?",
  }[der.emocion_actual] || "¿Qué deseas reciclar hoy?";
  const franjaPref = FRANJAS.find((f) => f.id === der.franja_preferida);

  return (
    <div className="paper-tex" style={{ minHeight: "100vh", background: "var(--cream)", display: "flex", flexDirection: "column" }}>
      <Navbar user={nombre} role="ciudadano" onLogout={handleLogout} />
      <main className="screen" style={{ maxWidth: 1120, width: "100%", margin: "0 auto", padding: "clamp(26px, 4vw, 44px) clamp(16px, 4vw, 36px) 40px", position: "relative", flex: 1 }}>
        <img src="/bolsas.png" alt="" style={{ position: "absolute", top: "1%", left: "-8%", width: 200, height: "auto", opacity: 0.45, transform: "scaleX(-1) rotate(6deg)", zIndex: 0, pointerEvents: "none", animation: "floaty 13s ease-in-out infinite" }} />

        {/* hero */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start", justifyContent: "space-between", position: "relative", zIndex: 2 }}>
          <div style={{ flex: "1 1 380px", minWidth: 280 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 9, whiteSpace: "nowrap", background: "var(--green-deep)", color: "#fff", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", padding: "8px 15px", borderRadius: 999 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--yellow)", boxShadow: "0 0 0 3px oklch(0.83 0.15 90 / 0.3)" }} />Lima · Reciclaje activo
            </span>
            <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(38px, 5.2vw, 60px)", color: "var(--ink)", margin: "16px 0 0", lineHeight: 1.03, letterSpacing: -0.5 }}>Hola, <span style={{ color: "var(--green)", fontStyle: "italic" }}>{nombre}</span> <span style={{ fontStyle: "normal" }}>👋</span></h1>
            <p style={{ fontFamily: "var(--sans)", fontSize: 18, color: "var(--ink-soft)", margin: "10px 0 0" }}>{subtitulo}</p>
            <button type="button" className="cta-voz" onClick={() => window.dispatchEvent(new CustomEvent("reci:abrir"))}
              style={{ marginTop: 18, display: "inline-flex", alignItems: "center", gap: 12, background: "var(--cream-card)", border: "1.5px solid var(--line)", borderRadius: 999, padding: "6px 20px 6px 6px", cursor: "pointer", boxShadow: "0 3px 0 oklch(0.88 0.03 120)", textAlign: "left" }}>
              <ReciMascota estado={der.emocion_actual === "frustracion" ? "empatico" : "feliz"} size={46} />
              <span>
                <span style={{ display: "block", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 14.5, color: "var(--ink)" }}>Díselo a Reci con tu voz</span>
                <span style={{ display: "block", fontFamily: "var(--sans)", fontSize: 13, color: "var(--ink-soft)", fontStyle: "italic" }}>«Quiero reciclar 3 kilos de {MAT[der.material_frecuente || "plastico"]?.label.toLowerCase()} mañana»</span>
              </span>
            </button>
          </div>
          <div style={{ flex: "0 1 400px", minWidth: 270 }}>
            <CheckInEmocional />
          </div>
        </div>

        {/* personalización continua: lo de siempre en un toque */}
        {der.material_frecuente && der.direccion_habitual && (
          <div className="pop" style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", background: "color-mix(in oklch, var(--yellow) 22%, var(--cream-card))", border: "1.5px solid var(--yellow)", borderRadius: 20, padding: "14px 18px" }}>
            <span style={{ width: 46, height: 46, borderRadius: 13, background: MAT[der.material_frecuente]?.color, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name={MAT[der.material_frecuente]?.icon} size={22} stroke="#fff" /></span>
            <div style={{ flex: "1 1 240px", minWidth: 0 }}>
              <p style={{ margin: 0, fontFamily: "var(--sans)", fontWeight: 700, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "oklch(0.5 0.1 80)" }}>✨ Para ti · lo de siempre</p>
              <p style={{ margin: "2px 0 0", fontFamily: "var(--serif)", fontSize: 20, color: "var(--ink)" }}>{der.kg_sugerido || 5} kg de {MAT[der.material_frecuente]?.label.toLowerCase()} · mañana {franjaPref ? "en la " + franjaPref.label.toLowerCase() : ""}</p>
              <p style={{ margin: 0, fontFamily: "var(--sans)", fontSize: 13, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{der.direccion_habitual}</p>
            </div>
            <button type="button" onClick={() => abrirModal({ paso: 3, data: { tipos: [der.material_frecuente], kg: der.kg_sugerido || 5, dia: 1, franja: der.franja_preferida || "manana" } })}
              style={{ fontFamily: "var(--serif)", fontSize: 17, color: "#fff", background: "var(--green)", border: "none", borderRadius: 999, padding: "11px 22px", cursor: "pointer", boxShadow: "0 4px 0 var(--green-deep)" }}>Repetir en 1 toque</button>
          </div>
        )}

        {/* mapa + nueva solicitud */}
        <div className="home-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)", gap: 18, marginTop: 22 }}>
          <div style={{ position: "relative", borderRadius: 24, overflow: "hidden", boxShadow: "0 6px 0 var(--green-deep)" }}>
            <MapaPlaceholder height={300} label="Recicladores cerca de ti · Puente Piedra" radius={0} />
            <button type="button" onClick={() => abrirModal()} style={{ position: "absolute", left: 18, bottom: 18, fontFamily: "var(--serif)", fontSize: 18, color: "#fff", background: "var(--green)", border: "none", borderRadius: 999, padding: "13px 24px", cursor: "pointer", boxShadow: "0 4px 0 var(--green-deep)", display: "inline-flex", alignItems: "center", gap: 10 }}
              onMouseDown={(e) => { e.currentTarget.style.transform = "translateY(2px)"; e.currentTarget.style.boxShadow = "0 2px 0 var(--green-deep)"; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 0 var(--green-deep)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 0 var(--green-deep)"; }}>
              <Icon name="plus" size={20} stroke="#fff" sw={2.6} />Nueva solicitud
            </button>
          </div>

          <div style={{ position: "relative", overflow: "hidden", background: "var(--green)", borderRadius: 24, boxShadow: "0 6px 0 var(--green-deep)", padding: 26, display: "flex", flexDirection: "column" }}>
            <img src="/bolsas.png" alt="" style={{ position: "absolute", right: "-12%", top: "-14%", width: 200, height: "auto", opacity: 0.55, zIndex: 0, pointerEvents: "none" }} />
            <div style={{ position: "absolute", right: "-8%", bottom: "-22%", zIndex: 0, pointerEvents: "none", animation: "floaty 9s ease-in-out infinite" }}><Starburst points={20} color="var(--yellow)" size={110} inner={0.52} style={{ opacity: 0.85 }} /></div>
            <div style={{ position: "relative", zIndex: 2 }}>
              <span style={{ width: 46, height: 46, borderRadius: 13, background: "var(--green-deep)", display: "grid", placeItems: "center" }}><Icon name="truck" size={24} stroke="#fff" /></span>
              <h2 style={{ fontFamily: "var(--serif)", fontSize: 28, color: "#fff", margin: "14px 0 0", lineHeight: 1.06 }}>Solicitar recolección</h2>
              <p style={{ fontFamily: "var(--sans)", fontSize: 15, color: "#fff", margin: "8px 0 0", lineHeight: 1.5 }}>Un reciclador pasa por tus materiales sin que salgas de casa.</p>
            </div>
            <button type="button" onClick={() => abrirModal()} style={{ position: "relative", zIndex: 2, marginTop: 20, alignSelf: "flex-start", fontFamily: "var(--serif)", fontSize: 17, color: "var(--green-deep)", background: "var(--cream)", border: "none", borderRadius: 999, padding: "12px 24px", cursor: "pointer", boxShadow: "0 4px 0 oklch(0.78 0.04 100)", display: "inline-flex", alignItems: "center", gap: 9 }}
              onMouseDown={(e) => { e.currentTarget.style.transform = "translateY(2px)"; e.currentTarget.style.boxShadow = "0 2px 0 oklch(0.78 0.04 100)"; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 0 oklch(0.78 0.04 100)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 0 oklch(0.78 0.04 100)"; }}>
              Programar ahora <span>→</span>
            </button>
          </div>
        </div>

        {/* impacto (reflexivo) + accesos */}
        <div style={{ marginTop: 18 }}>
          <TarjetaImpacto creditos={user?.eco_creditos ?? 0} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginTop: 16 }}>
            <DashCard accent="var(--orange)" badgeBg="var(--orange)" icon="clipboard" title="Mis solicitudes" sub="Rastrea tus recolecciones" onClick={() => navigate("/ciudadano/solicitudes")} />
            <DashCard accent="var(--blue)" badgeBg="var(--blue)" icon="user" title="Mis salas" sub="Metas con tus vecinos" onClick={() => navigate("/salas")} />
            <DashCard accent="var(--pink)" badgeBg="var(--pink)" icon="settings" title="Voz y accesibilidad" sub="Ajusta cómo te habla Reci" onClick={() => navigate("/perfil")} />
          </div>
        </div>

        {/* materiales */}
        <div style={{ marginTop: 34 }}>
          <h3 style={{ fontFamily: "var(--serif)", fontSize: "clamp(22px, 2.6vw, 28px)", color: "var(--ink)", margin: "0 0 4px" }}>¿Qué puedes <span style={{ color: "var(--green)", fontStyle: "italic" }}>reciclar</span>?</h3>
          <p style={{ fontFamily: "var(--sans)", fontSize: 14.5, color: "var(--ink-soft)", margin: "0 0 16px" }}>Separa por tipo y suma eco-créditos por cada entrega.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(116px, 1fr))", gap: 12 }}>
            {MATERIALES.map((m) => <MaterialCard key={m.id} mat={m} onClick={() => abrirModal({ paso: 1, data: { tipos: [m.id] } })} />)}
          </div>
        </div>
      </main>

      <footer style={{ background: "var(--green)", textAlign: "center", padding: "22px 20px 96px", marginTop: 30 }}>
        <span style={{ fontFamily: "var(--serif)", fontSize: "clamp(20px, 2.4vw, 26px)", color: "#fff" }}>♻ Juntos por una <span style={{ color: "var(--cream)", fontStyle: "italic" }}>Lima</span> más limpia</span>
      </footer>

      <NuevaSolicitudModal open={modal} inicial={inicial} onClose={() => setModal(false)} onSubmit={handleCrearSolicitud} />
    </div>
  );
}
