"""NLU local basado en reglas (español peruano).

Se usa de dos formas:
  1. Como proveedor "mock" completamente offline (no requiere API key).
  2. Como red de seguridad de cualquier LLM remoto: si el modelo no devuelve
     JSON válido o omite un slot, estos extractores deterministas completan
     el borrador de solicitud.

Todas las funciones son puras -> fáciles de testear.
"""
from __future__ import annotations

import re
import unicodedata
from datetime import date, timedelta

# ── Normalización ─────────────────────────────────────────────────────────────

def normalizar(texto: str) -> str:
    """minúsculas + sin tildes + espacios simples."""
    t = unicodedata.normalize("NFD", texto or "")
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", t.lower()).strip()


# ── Materiales ────────────────────────────────────────────────────────────────

SINONIMOS_MATERIAL: dict[str, list[str]] = {
    "plastico": ["plastico", "plasticos", "botella de plastico", "botellas de plastico", "botellas pet",
                 "pet", "tapers", "taper", "bolsas plasticas", "envases plasticos", "botellas"],
    "papel": ["papel", "papeles", "periodico", "periodicos", "hojas", "cuadernos", "revistas", "libros viejos"],
    "carton": ["carton", "cartones", "cajas", "caja", "cajas de carton"],
    "vidrio": ["vidrio", "vidrios", "frascos", "frasco", "botellas de vidrio", "botella de vidrio"],
    "metal": ["metal", "metales", "latas", "lata", "chatarra", "aluminio", "fierro"],
    "organico": ["organico", "organicos", "restos de comida", "cascaras", "compost", "residuos de cocina"],
    "electronicos": ["electronico", "electronicos", "celular", "celulares", "pilas", "baterias", "cables",
                     "laptop", "computadora", "raee", "televisor", "cargadores"],
}

ETIQUETA_MATERIAL = {
    "plastico": "plástico", "papel": "papel", "carton": "cartón", "vidrio": "vidrio",
    "metal": "metal", "organico": "orgánico", "electronicos": "electrónicos",
}


def extraer_materiales(texto_norm: str) -> list[str]:
    """Devuelve materiales en orden de aparición, sin repetir.
    Prioriza frases largas ("botellas de vidrio" antes que "botellas")."""
    encontrados: list[tuple[int, str]] = []
    ocupado: list[tuple[int, int]] = []
    pares = sorted(
        ((sin, mat) for mat, sins in SINONIMOS_MATERIAL.items() for sin in sins),
        key=lambda p: -len(p[0]),
    )
    for sin, mat in pares:
        for m in re.finditer(r"\b" + re.escape(sin) + r"\b", texto_norm):
            ini, fin = m.span()
            if any(not (fin <= a or ini >= b) for a, b in ocupado):
                continue
            ocupado.append((ini, fin))
            encontrados.append((ini, mat))
    vistos: list[str] = []
    for _, mat in sorted(encontrados):
        if mat not in vistos:
            vistos.append(mat)
    return vistos


# ── Cantidad ──────────────────────────────────────────────────────────────────

NUMEROS = {
    "medio": 0.5, "un": 1, "uno": 1, "una": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5,
    "seis": 6, "siete": 7, "ocho": 8, "nueve": 9, "diez": 10, "once": 11, "doce": 12,
    "quince": 15, "veinte": 20, "treinta": 30, "cuarenta": 40, "cincuenta": 50,
}
_UNIDAD = r"(?:kg|kilo|kilos|kilogramo|kilogramos|k)\b"


def extraer_cantidad_kg(texto_norm: str) -> float | None:
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*" + _UNIDAD, texto_norm)
    if m:
        return float(m.group(1).replace(",", "."))
    m = re.search(r"\b(" + "|".join(NUMEROS) + r")\s+(?:y\s+medio\s+)?" + _UNIDAD, texto_norm)
    if m:
        base = NUMEROS[m.group(1)]
        return base + (0.5 if "y medio" in m.group(0) else 0)
    if re.search(r"\bmedio\s+kilo", texto_norm):
        return 0.5
    # "una bolsa" ≈ 3 kg, "un saco" ≈ 10 kg (estimación declarada al usuario)
    m = re.search(r"\b(\d+|" + "|".join(NUMEROS) + r")\s+(bolsas?|sacos?|cajas?)\b", texto_norm)
    if m:
        n = float(m.group(1)) if m.group(1).isdigit() else NUMEROS[m.group(1)]
        factor = 10 if m.group(2).startswith("saco") else 3
        return n * factor
    return None


# ── Fecha y franja ────────────────────────────────────────────────────────────

DIAS_SEMANA = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]


def extraer_franja(texto_norm: str) -> str | None:
    if re.search(r"\b(en|por|de|a)\s+la\s+manana\b|\btemprano\b", texto_norm):
        return "manana"
    if re.search(r"\b(en|por|de|a)\s+la\s+tarde\b|\btarde\b", texto_norm):
        return "tarde"
    if re.search(r"\b(en|por|de|a)\s+la\s+noche\b|\bnoche\b", texto_norm):
        return "noche"
    return None


def extraer_dia_offset(texto_norm: str, hoy: date | None = None) -> int | None:
    """Días a sumar a hoy. 'mañana' cuenta como día solo si no es 'la mañana'."""
    hoy = hoy or date.today()
    if re.search(r"\bpasado\s+manana\b", texto_norm):
        return 2
    if re.search(r"\bhoy\b|\bahorita\b|\bahora\b", texto_norm):
        return 0
    if re.search(r"(?<!la )\bmanana\b", texto_norm):
        return 1
    for i, d in enumerate(DIAS_SEMANA):
        if re.search(r"\b" + d + r"\b", texto_norm):
            return (i - hoy.weekday()) % 7 or 7
    return None


def fecha_desde_offset(offset: int, hoy: date | None = None) -> str:
    return ((hoy or date.today()) + timedelta(days=offset)).isoformat()


# ── Emoción declarada / inferida por texto ────────────────────────────────────

LEXICO_EMOCION: dict[str, list[str]] = {
    "frustracion": ["no funciona", "harto", "harta", "molesto", "molesta", "otra vez", "no entiendo",
                    "complicado", "dificil", "fastidio", "no sirve", "error", "cansado de", "pesimo", "aburrido"],
    "ansiedad": ["urgente", "rapido", "apurado", "apurada", "ya mismo", "preocupado", "preocupada", "nervioso"],
    "tristeza": ["triste", "desanimado", "desanimada", "mal dia", "deprimido", "sola", "solo"],
    "alegria": ["genial", "excelente", "gracias", "feliz", "contento", "contenta", "chevere", "bacan",
                "buenazo", "me encanta", "super", "increible", "bravazo"],
}


def detectar_emocion(texto_norm: str) -> str | None:
    puntajes = {e: sum(1 for p in pals if re.search(r"\b" + re.escape(p) + r"\b", texto_norm))
                for e, pals in LEXICO_EMOCION.items()}
    emocion, pts = max(puntajes.items(), key=lambda kv: kv[1])
    return emocion if pts > 0 else None


# ── Intención ─────────────────────────────────────────────────────────────────

PATRONES_INTENCION: list[tuple[str, str]] = [
    ("confirmar", r"^(si|sip|ya|dale|ok|okey|listo|claro|correcto|de acuerdo|perfecto)\b(?!\s+(viene|llega|llego))|\bconfirm"),
    ("cancelar", r"^(no|nop|cancela|cancelar|mejor no|olvidalo)$|^cancela"),
    ("seguimiento", r"donde (esta|viene)|seguimiento|rastrear|ya viene|cuanto falta|llega"),
    ("ver_solicitudes", r"mis solicitudes|ver solicitudes|historial|estado de mi"),
    ("salas", r"\bsala|\bsalas|comunidad|vecinos|grupo|campana|unirme"),
    ("impacto", r"eco.?creditos|puntos|impacto|cuanto he reciclado|\bnivel\b|co2|arboles"),
    ("disponibles", r"solicitudes disponibles|que hay para recoger|recojo disponible|pedidos"),
    ("perfil", r"\bperfil\b|configuracion|accesibilidad|letra|voz mas lenta|despacio|mas lento|contraste|ajustes"),
    ("como_reciclar", r"(se|puedo) recicla|como (separo|reciclo|lavo)|va en|se bota|que hago con"),
    ("crear_solicitud", r"recicl|recoj|recog|program|solicit|vengan|pasen por|llevar|tengo .*(kg|kilo|bolsa|saco|caja)"),
    ("saludo", r"^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|que tal)\b"),
    ("despedida", r"\b(chau|adios|hasta luego|nos vemos)\b"),
    ("ayuda", r"ayuda|que puedes hacer|como funciona|no se como"),
]


_PATRON = dict(PATRONES_INTENCION)
_VERBO_PEDIDO = r"recicl|recoj|recog|program|solicit|vengan|pasen|tengo|quiero|necesito|llevar|botar"


def detectar_intencion(texto_norm: str, materiales: list[str], kg: float | None) -> str:
    # "¿se recicla el vidrio?" es una consulta, no un pedido de recojo
    if re.search(_PATRON["como_reciclar"], texto_norm):
        return "como_reciclar"
    if (materiales or kg) and re.search(_VERBO_PEDIDO, texto_norm):
        return "crear_solicitud"
    for intent, patron in PATRONES_INTENCION:
        if re.search(patron, texto_norm):
            return intent
    if materiales or kg:
        return "crear_solicitud"
    if detectar_emocion(texto_norm):
        return "emocion"
    return "desconocido"


CONSEJOS = {
    "plastico": "Enjuaga las botellas, quítales la tapa y aplástalas para que ocupen menos espacio.",
    "papel": "Debe estar seco y limpio; el papel con grasa (como cajas de pizza) va a orgánico.",
    "carton": "Desarma las cajas y mantenlas secas. Si se mojaron, sepáralas.",
    "vidrio": "Enjuaga los frascos y no los mezcles con focos ni espejos. Envuélvelos si están rotos.",
    "metal": "Enjuaga las latas y aplástalas. Las latas de pintura van aparte.",
    "organico": "Usa una bolsa o tacho con tapa; ideal para compostaje del barrio.",
    "electronicos": "No los botes con la basura común: tienen metales pesados. Retira las pilas y guárdalas aparte.",
}


def analizar(texto: str, hoy: date | None = None) -> dict:
    """Análisis completo del enunciado -> dict serializable."""
    t = normalizar(texto)
    materiales = extraer_materiales(t)
    kg = extraer_cantidad_kg(t)
    intencion = detectar_intencion(t, materiales, kg)
    dia = extraer_dia_offset(t, hoy)
    return {
        "texto_normalizado": t,
        "intencion": intencion,
        "slots": {
            "tipos": materiales,
            "cantidad_kg": kg,
            "dia_offset": dia,
            "fecha_recoleccion": fecha_desde_offset(dia, hoy) if dia is not None else None,
            "franja_horaria": extraer_franja(t),
        },
        "emocion": detectar_emocion(t),
    }
