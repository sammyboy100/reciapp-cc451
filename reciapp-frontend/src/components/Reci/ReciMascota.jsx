// ============================================================
// Reci — mascota del asistente (nivel visceral del diseño emocional).
// Su expresión refleja el estado de la conversación y el tono adaptado
// al usuario: feliz, escuchando, pensando, hablando, empatico, celebrando.
// ============================================================
import React from "react";
import { Starburst } from "../ui/Primitivos";

const OJOS = {
  feliz:      { ry: 7,   dy: 0,  cerrado: false },
  escuchando: { ry: 8.5, dy: 0,  cerrado: false },
  pensando:   { ry: 6.5, dy: -3, cerrado: false },
  hablando:   { ry: 7,   dy: 0,  cerrado: false },
  empatico:   { ry: 5.5, dy: 1,  cerrado: false },
  celebrando: { ry: 7,   dy: 0,  cerrado: true },
  calido:     { ry: 6,   dy: 1,  cerrado: false },
};

const BOCA = {
  feliz:      "M48 74 Q60 84 72 74",
  escuchando: "M53 76 Q60 80 67 76",
  pensando:   "M52 77 Q58 75 66 78",
  hablando:   "M50 73 Q60 88 70 73 Q60 80 50 73Z",
  empatico:   "M51 77 Q60 82 69 77",
  celebrando: "M46 71 Q60 92 74 71 Q60 78 46 71Z",
  calido:     "M50 75 Q60 82 70 75",
};

export default function ReciMascota({ estado = "feliz", size = 96, nivel = 0, style }) {
  const o = OJOS[estado] || OJOS.feliz;
  const boca = BOCA[estado] || BOCA.feliz;
  const relleno = estado === "hablando" || estado === "celebrando";
  const escala = 1 + (estado === "escuchando" ? nivel * 0.08 : 0);

  return (
    <div className={"reci-mascota reci-" + estado} style={{ position: "relative", width: size, height: size, flexShrink: 0, ...style }} aria-hidden="true">
      {estado === "celebrando" && (
        <div style={{ position: "absolute", inset: -size * 0.18, animation: "spin 9s linear infinite", opacity: 0.9 }}>
          <Starburst points={18} color="var(--yellow)" size={size * 1.36} inner={0.62} />
        </div>
      )}
      {estado === "escuchando" && (
        <span style={{ position: "absolute", inset: -6, borderRadius: "50%", border: "3px solid var(--green-soft)", transform: `scale(${1.05 + nivel * 0.25})`, opacity: 0.4 + nivel * 0.5, transition: "transform .08s, opacity .08s" }} />
      )}
      <svg viewBox="0 0 120 120" width={size} height={size} style={{ position: "relative", transform: `scale(${escala})`, transition: "transform .08s" }}>
        {/* brote */}
        <g className="reci-brote">
          <path d="M60 26 C 60 16, 56 10, 50 6" stroke="var(--green-deep)" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M51 8 C 38 4, 30 14, 34 22 C 44 24, 52 18, 51 8Z" fill="var(--green-soft)" />
          <path d="M58 14 C 66 2, 82 4, 82 14 C 74 22, 62 22, 58 14Z" fill="var(--green-deep)" />
        </g>
        {/* sombra "3D" igual que los botones de la app */}
        <path d="M20 66 C 20 38, 38 24, 60 24 C 82 24, 100 38, 100 66 C 100 92, 82 108, 60 108 C 38 108, 20 92, 20 66Z" fill="var(--green-deep)" transform="translate(0 5)" />
        <path d="M20 66 C 20 38, 38 24, 60 24 C 82 24, 100 38, 100 66 C 100 92, 82 108, 60 108 C 38 108, 20 92, 20 66Z" fill="var(--green)" />
        <path d="M30 52 C 34 38, 46 31, 58 30" stroke="oklch(1 0 0 / 0.35)" strokeWidth="5" fill="none" strokeLinecap="round" />
        {/* mejillas */}
        <ellipse cx="38" cy="74" rx="7" ry="4.5" fill="var(--pink)" opacity={estado === "empatico" || estado === "calido" ? 0.75 : 0.5} />
        <ellipse cx="82" cy="74" rx="7" ry="4.5" fill="var(--pink)" opacity={estado === "empatico" || estado === "calido" ? 0.75 : 0.5} />
        {/* ojos */}
        {o.cerrado ? (
          <g stroke="var(--ink)" strokeWidth="4" fill="none" strokeLinecap="round">
            <path d="M40 60 Q46 52 52 60" /><path d="M68 60 Q74 52 80 60" />
          </g>
        ) : (
          <g className="reci-ojos">
            <ellipse cx="46" cy={60 + o.dy} rx="6" ry={o.ry} fill="var(--ink)" />
            <ellipse cx="74" cy={60 + o.dy} rx="6" ry={o.ry} fill="var(--ink)" />
            <circle cx="48" cy={57 + o.dy} r="2.2" fill="#fff" />
            <circle cx="76" cy={57 + o.dy} r="2.2" fill="#fff" />
          </g>
        )}
        {estado === "empatico" && (
          <g stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round">
            <path d="M38 47 L52 50" /><path d="M82 47 L68 50" />
          </g>
        )}
        {/* boca */}
        <path className={estado === "hablando" ? "reci-boca-habla" : ""} d={boca}
          fill={relleno ? "var(--ink)" : "none"} stroke="var(--ink)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        {estado === "pensando" && (
          <g fill="var(--cream)">
            <circle cx="96" cy="30" r="4" /><circle cx="105" cy="20" r="5.5" /><circle cx="113" cy="8" r="6.5" />
          </g>
        )}
      </svg>
    </div>
  );
}

/** Traduce tono del asistente + estado de la conversación a expresión. */
export function expresionPara({ escuchando, hablando, pensando, tono, celebrar }) {
  if (celebrar) return "celebrando";
  if (escuchando) return "escuchando";
  if (pensando) return "pensando";
  if (hablando) return "hablando";
  if (tono === "empatico") return "empatico";
  if (tono === "calido") return "calido";
  if (tono === "celebratorio") return "celebrando";
  return "feliz";
}
