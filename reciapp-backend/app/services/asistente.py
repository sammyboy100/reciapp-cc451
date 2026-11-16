"""Asistente conversacional "Reci" (voz y texto).

Flujo por cada mensaje:
  1. NLU local (determinista) extrae intención, slots y emoción.
  2. El proveedor LLM activo (local o remoto) devuelve JSON con la misma forma
     y, si es remoto, una respuesta en lenguaje natural.
  3. Se fusionan ambos resultados, se completan los huecos con lo aprendido en
     el perfil (franja, dirección, kg habituales) y se decide una acción de UI.
  4. El perfil se actualiza (canal usado, emoción detectada).
"""
from __future__ import annotations

import json
import re
from random import Random

from sqlalchemy.orm import Session

from app.crud import crud_perfil
from app.llm import nlu
from app.llm.base import Mensaje
from app.llm.factory import completar_con_respaldo, proveedor_activo
from app.models.solicitud import Solicitud
from app.models.user import Usuario
from app.services import impacto
from app.services import perfil_adaptativo as pa

INTENCIONES = {"crear_solicitud", "ver_solicitudes", "seguimiento", "salas", "impacto", "disponibles",
               "perfil", "como_reciclar", "confirmar", "cancelar", "saludo", "despedida", "ayuda", "emocion", "desconocido"}
MATERIALES = set(nlu.SINONIMOS_MATERIAL)
FRANJAS = {"manana": "en la mañana", "tarde": "en la tarde", "noche": "en la noche"}

SYSTEM_PROMPT = """Eres "Reci", el asistente de voz de ReciApp, una PWA que conecta a vecinos de Lima \
(Puente Piedra) con recicladores formales. Hablas español peruano, claro y breve (máximo 2 oraciones, \
porque tu respuesta se leerá en voz alta). Nunca inventes datos de solicitudes.

Tono a usar ahora: {tono}. Guía: {guia_tono}
Nivel de detalle: {nivel_guia}.
Contexto del usuario (perfil aprendido): {contexto}

Responde SOLO con un objeto JSON con esta forma:
{{"intencion": una de {intenciones},
  "slots": {{"tipos": [materiales entre {materiales}], "cantidad_kg": número o null,
            "dia_offset": 0=hoy,1=mañana,... o null, "franja_horaria": "manana"|"tarde"|"noche"|null}},
  "emocion": "alegria"|"calma"|"frustracion"|"ansiedad"|"tristeza"|"cansancio"|null,
  "respuesta": "lo que dirás al usuario"}}"""

GUIA_TONO = {
    "amigable": "cercano y positivo, sin exagerar.",
    "empatico": "valida la molestia primero, discúlpate brevemente y ofrece el siguiente paso más simple.",
    "celebratorio": "entusiasta, reconoce el logro del usuario.",
    "directo": "ve al grano, sin rodeos, confirma lo esencial.",
    "calido": "suave y alentador, recuerda que cada pequeño gesto cuenta.",
    "formal": "respetuoso y claro, trato de usted.",
}

APERTURA = {
    "amigable": ["¡Listo!", "¡Perfecto!", "¡Dale!"],
    "empatico": ["Entiendo, vamos con calma.", "Tranquilo, lo resolvemos juntos.", "Perdón por la complicación."],
    "celebratorio": ["¡Qué buena!", "¡Bravazo!", "¡Excelente!"],
    "directo": ["Hecho.", "Ok.", "Anotado."],
    "calido": ["Con gusto te ayudo.", "Aquí estoy para ayudarte.", "Vamos paso a paso."],
    "formal": ["Con mucho gusto.", "Entendido.", "Por supuesto."],
}


# ── Utilidades ────────────────────────────────────────────────────────────────

def _parse_json(texto: str) -> dict:
    if not texto:
        return {}
    m = re.search(r"\{.*\}", texto, re.S)
    if not m:
        return {}
    try:
        data = json.loads(m.group(0))
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        return {}


def _validar_slots(s: dict | None) -> dict:
    s = s or {}
    out: dict = {}
    tipos = [t for t in (s.get("tipos") or []) if t in MATERIALES]
    if tipos:
        out["tipos"] = tipos
    try:
        kg = float(s.get("cantidad_kg")) if s.get("cantidad_kg") is not None else None
        if kg and 0 < kg <= 500:
            out["cantidad_kg"] = kg
    except (TypeError, ValueError):
        pass
    dia = s.get("dia_offset")
    if isinstance(dia, int) and 0 <= dia <= 14:
        out["dia_offset"] = dia
    if s.get("franja_horaria") in FRANJAS:
        out["franja_horaria"] = s["franja_horaria"]
    return out


def _lista(items: list[str]) -> str:
    items = [nlu.ETIQUETA_MATERIAL.get(i, i) for i in items]
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " y " + items[-1]


def _dia_texto(d: int | None) -> str:
    return {None: "", 0: "hoy", 1: "mañana", 2: "pasado mañana"}.get(d, f"en {d} días")


def comandos_accesibilidad(texto_norm: str, perfil: dict) -> dict:
    """Comandos de voz que cambian preferencias directamente."""
    pref = pa.normalizar(perfil)["preferencias"]
    cambios: dict = {}
    if re.search(r"letra(s)? (mas )?grande|aumenta(r)? (la )?letra|no veo bien|zoom", texto_norm):
        cambios["tamano_fuente"] = "muy_grande" if pref["tamano_fuente"] == "grande" else "grande"
    if re.search(r"letra (mas )?(pequena|normal)|reduce (la )?letra", texto_norm):
        cambios["tamano_fuente"] = "normal"
    if re.search(r"habla (mas )?(lento|despacio)|mas despacio", texto_norm):
        cambios["velocidad_voz"] = round(max(0.6, (pref["velocidad_voz"] or 1.0) - 0.15), 2)
    if re.search(r"habla (mas )?rapido|mas rapido", texto_norm):
        cambios["velocidad_voz"] = round(min(1.4, (pref["velocidad_voz"] or 1.0) + 0.15), 2)
    if re.search(r"lee(me)? (en voz alta|todo)|leeme|activa (la )?lectura", texto_norm):
        cambios["lectura_automatica"] = True
    if re.search(r"(no|deja de) leer|silencio|calla", texto_norm):
        cambios["lectura_automatica"] = False
    if re.search(r"alto contraste|mas contraste", texto_norm):
        cambios["alto_contraste"] = True
    if re.search(r"modo (simple|facil)|mas (simple|facil)", texto_norm):
        cambios["modo_simple"] = True
    return cambios


# ── Redacción con plantillas (proveedor local o respaldo) ────────────────────

def redactar(intencion: str, tono: str, nombre: str, borrador: dict, faltantes: list[str],
             extra: dict, semilla: int = 0) -> str:
    rnd = Random(semilla)
    ap = rnd.choice(APERTURA.get(tono, APERTURA["amigable"]))
    usted = tono == "formal"

    if intencion == "crear_solicitud":
        if "tipos" in faltantes:
            return f"{ap} ¿Qué material {'desea' if usted else 'quieres'} reciclar? Por ejemplo plástico, papel, cartón o vidrio."
        mats = _lista(borrador["tipos"])
        if "cantidad_kg" in faltantes:
            return f"{ap} Anoto {mats}. ¿Cuántos kilos más o menos? Si no sabes, una bolsa grande son unos 3 kilos."
        dia = _dia_texto(borrador.get("dia_offset"))
        franja = FRANJAS.get(borrador.get("franja_horaria"), "")
        auto = extra.get("autocompletado") or []
        nota = " Usé tu dirección de siempre." if "direccion" in auto else ""
        return (f"{ap} Prepararé el recojo de {borrador['cantidad_kg']:g} kg de {mats} {dia} {franja}.{nota} "
                f"¿{'Confirma' if usted else 'Confirmas'}?").replace("  ", " ")
    if intencion == "confirmar":
        if extra.get("confirmado"):
            return f"{ap} Registro tu solicitud ahora mismo. Te aviso cuando un reciclador la acepte."
        return "¿Qué deseas confirmar? Cuéntame qué material quieres reciclar."
    if intencion == "cancelar":
        return "Ok, lo dejamos ahí. Cuando quieras retomamos."
    if intencion == "ver_solicitudes":
        n = extra.get("activas", 0)
        return f"{ap} Tienes {n} solicitud{'es' if n != 1 else ''} en curso. Te muestro la lista."
    if intencion == "seguimiento":
        if extra.get("seguimiento_id"):
            return f"{ap} Tu reciclador ya está en camino. Abro el mapa para que lo veas en vivo."
        return "Por ahora ningún reciclador está en camino. Te aviso apenas alguien acepte tu solicitud."
    if intencion == "salas":
        return f"{ap} Abro tus salas: ahí ves la meta de tu comunidad y puedes invitar a tus vecinos."
    if intencion == "impacto":
        imp = extra.get("impacto") or {}
        return (f"Has reciclado {imp.get('kg_total', 0):g} kg y evitado unos {imp.get('co2_evitado_kg', 0):g} kg de CO₂, "
                f"como {imp.get('arboles_equivalentes', 0):g} árboles en un año. Tu nivel es {imp.get('nivel', {}).get('nombre', 'Semilla')}.")
    if intencion == "disponibles":
        n = extra.get("disponibles", 0)
        return f"{ap} Hay {n} solicitud{'es' if n != 1 else ''} disponible{'s' if n != 1 else ''} para recoger. Te las muestro."
    if intencion == "perfil":
        if extra.get("preferencias_aplicadas"):
            return f"{ap} Ya ajusté tu configuración. Dime si lo quieres de otra forma."
        return f"{ap} Abro tu perfil para que ajustes voz, tamaño de letra y contraste."
    if intencion == "como_reciclar":
        mats = borrador.get("tipos") or []
        if mats:
            return nlu.CONSEJOS[mats[0]]
        return "Separa por tipo: plástico, papel y cartón, vidrio, metal y electrónicos. Todo limpio y seco."
    if intencion == "saludo":
        return f"¡Hola, {nombre}! Soy Reci. Puedes decirme, por ejemplo: «quiero reciclar 3 kilos de plástico mañana en la tarde»."
    if intencion == "despedida":
        return f"¡Hasta pronto, {nombre}! Gracias por cuidar Lima."
    if intencion == "ayuda":
        return "Puedo programar recojos, decirte dónde está tu reciclador, mostrar tu impacto, abrir tus salas o agrandar la letra. Solo dímelo."
    if intencion == "emocion":
        emo = extra.get("emocion")
        if emo == "frustracion":
            return "Siento que algo no esté saliendo bien. Probemos lo más simple: dime qué material tienes y yo hago el resto."
        if emo in {"tristeza", "cansancio"}:
            return "Gracias por contármelo. Cada pequeño gesto cuenta, y hoy ya estás aportando a tu barrio."
        if emo == "ansiedad":
            return "Vamos rápido: dime material y cantidad, y lo programo para hoy si hay recicladores."
        return "¡Qué bueno saberlo! Me alegra acompañarte."
    return "No te entendí del todo. Prueba con: «reciclar 2 kilos de cartón mañana» o «¿dónde está mi reciclador?»."


# ── Orquestación ─────────────────────────────────────────────────────────────

def responder(db: Session, usuario: Usuario, mensaje: str, canal: str = "texto",
              historial: list[dict] | None = None, borrador_actual: dict | None = None) -> dict:
    perfil = crud_perfil.obtener(db, usuario.id)
    datos = pa.normalizar(perfil.datos)
    texto_norm = nlu.normalizar(mensaje)
    local = nlu.analizar(mensaje)

    # 0) Comandos de accesibilidad por voz: se aplican sin pasar por el LLM
    cambios = comandos_accesibilidad(texto_norm, datos)
    if cambios:
        perfil = crud_perfil.registrar_evento(db, usuario.id, "preferencias", cambios)
        datos = pa.normalizar(perfil.datos)

    deriv = pa.derivar(datos)
    contexto = {
        "nombre": usuario.nombre.split(" ")[0], "rol": usuario.rol,
        "material_frecuente": deriv["material_frecuente"], "franja_preferida": deriv["franja_preferida"],
        "direccion_habitual": deriv["direccion_habitual"], "emocion_reciente": deriv["emocion_actual"],
        "borrador_en_curso": borrador_actual or None,
    }
    prompt = SYSTEM_PROMPT.format(tono=deriv["tono_asistente"], guia_tono=GUIA_TONO[deriv["tono_asistente"]],
                                  nivel_guia=deriv["nivel_guia"], contexto=json.dumps(contexto, ensure_ascii=False),
                                  intenciones=sorted(INTENCIONES), materiales=sorted(MATERIALES))
    mensajes = [Mensaje("system", prompt)]
    for h in (historial or [])[-6:]:
        if h.get("rol") in {"user", "assistant"} and h.get("texto"):
            mensajes.append(Mensaje(h["rol"], h["texto"][:500]))
    mensajes.append(Mensaje("user", mensaje))

    resp, uso_respaldo = completar_con_respaldo(mensajes)
    llm = _parse_json(resp.texto)

    # 1) Intención: preferir la del LLM si es válida
    intencion = llm.get("intencion") if llm.get("intencion") in INTENCIONES else local["intencion"]
    if cambios and intencion in {"desconocido", "ayuda", "emocion"}:
        intencion = "perfil"
    # Continuación de un borrador: "5 kilos" después de "quiero reciclar plástico"
    if borrador_actual and intencion in {"desconocido", "emocion"} and any(local["slots"].values()):
        intencion = "crear_solicitud"

    # 2) Slots: local como base, LLM los mejora, el borrador previo rellena
    slots = {k: v for k, v in local["slots"].items() if v not in (None, [])}
    slots.update(_validar_slots(llm.get("slots")))
    borrador = {**(borrador_actual or {}), **slots}

    # 3) Emoción detectada en el texto => perfil
    emocion = llm.get("emocion") if llm.get("emocion") in pa.EMOCIONES_VALIDAS else local["emocion"]
    if emocion:
        perfil = crud_perfil.registrar_evento(db, usuario.id, "emocion",
                                              {"emocion": emocion, "fuente": "inferida", "canal": canal})
        deriv = pa.derivar(perfil.datos)

    extra: dict = {"emocion": emocion}
    accion: dict = {"tipo": "ninguna"}
    faltantes: list[str] = []

    if intencion == "crear_solicitud":
        autocompletado = []
        if "franja_horaria" not in borrador and deriv["franja_preferida"]:
            borrador["franja_horaria"] = deriv["franja_preferida"]
            autocompletado.append("franja_horaria")
        if "dia_offset" not in borrador:
            borrador["dia_offset"] = 1
        if deriv["direccion_habitual"] and "direccion" not in borrador:
            borrador["direccion"] = deriv["direccion_habitual"]
            if deriv["coords_habituales"]:
                borrador["latitud"], borrador["longitud"] = deriv["coords_habituales"]
            autocompletado.append("direccion")
        borrador.setdefault("franja_horaria", "manana")
        faltantes = [c for c in ("tipos", "cantidad_kg") if not borrador.get(c)]
        borrador.pop("fecha_recoleccion", None)
        extra["autocompletado"] = autocompletado
        accion = ({"tipo": "preguntar", "campo": faltantes[0]} if faltantes
                  else {"tipo": "confirmar_solicitud", "borrador": borrador, "autocompletado": autocompletado})
    elif intencion == "confirmar":
        completo = bool(borrador.get("tipos") and borrador.get("cantidad_kg"))
        extra["confirmado"] = completo
        accion = {"tipo": "crear_solicitud", "borrador": borrador} if completo else {"tipo": "ninguna"}
    elif intencion == "cancelar":
        accion = {"tipo": "cancelar_borrador"}
    elif intencion == "ver_solicitudes":
        extra["activas"] = db.query(Solicitud).filter(
            Solicitud.ciudadano_id == usuario.id,
            Solicitud.estado.in_(["pendiente", "asignada", "en_camino", "pendiente_confirmacion"])).count()
        accion = {"tipo": "navegar", "ruta": "/ciudadano/solicitudes"}
    elif intencion == "seguimiento":
        s = db.query(Solicitud).filter(Solicitud.ciudadano_id == usuario.id, Solicitud.estado == "en_camino") \
            .order_by(Solicitud.fecha_actualizacion.desc()).first()
        extra["seguimiento_id"] = s.id if s else None
        accion = ({"tipo": "navegar", "ruta": f"/ciudadano/solicitudes/{s.id}/seguimiento"} if s
                  else {"tipo": "navegar", "ruta": "/ciudadano/solicitudes"})
    elif intencion == "salas":
        accion = {"tipo": "navegar", "ruta": "/salas"}
    elif intencion == "impacto":
        extra["impacto"] = impacto.calcular(crud_perfil.solicitudes_completadas(db, usuario.id, usuario.rol))
        accion = {"tipo": "mostrar_impacto", "impacto": extra["impacto"]}
    elif intencion == "disponibles":
        extra["disponibles"] = db.query(Solicitud).filter(Solicitud.estado == "pendiente").count()
        accion = {"tipo": "navegar", "ruta": "/reciclador"}
    elif intencion == "perfil":
        extra["preferencias_aplicadas"] = bool(cambios)
        accion = ({"tipo": "aplicar_preferencias", "cambios": cambios} if cambios
                  else {"tipo": "navegar", "ruta": "/perfil"})

    # 4) Texto final: el del LLM remoto si lo dio; si no, plantillas por tono
    tono = deriv["tono_asistente"]
    usar_llm = (not uso_respaldo and resp.proveedor != "local" and isinstance(llm.get("respuesta"), str)
                and llm["respuesta"].strip() and intencion not in {"impacto"})
    texto = llm["respuesta"].strip() if usar_llm else redactar(
        intencion, tono, usuario.nombre.split(" ")[0], borrador, faltantes, extra,
        semilla=len(mensaje) + datos["aprendido"]["interacciones"])

    crud_perfil.registrar_evento(db, usuario.id, "interaccion", {"canal": canal, "intencion": intencion})

    return {
        "respuesta": texto,
        "intencion": intencion,
        "tono": tono,
        "emocion_detectada": emocion,
        "borrador": borrador if intencion == "crear_solicitud" else None,
        "faltantes": faltantes,
        "accion": accion,
        "sugerencias": _sugerencias(intencion, usuario.rol, deriv),
        "velocidad_voz": deriv["velocidad_voz"],
        "proveedor": resp.proveedor,
        "modelo": resp.modelo,
        "uso_respaldo": uso_respaldo,
        "latencia_ms": resp.latencia_ms,
    }


def _sugerencias(intencion: str, rol: str, deriv: dict) -> list[str]:
    if rol == "reciclador":
        return ["¿Qué solicitudes hay?", "Mis salas", "Habla más lento"]
    mat = nlu.ETIQUETA_MATERIAL.get(deriv["material_frecuente"] or "plastico")
    if intencion == "crear_solicitud":
        return ["Sí, confirmo", "Mejor en la tarde", "Son 5 kilos"]
    return [f"Reciclar {mat} mañana", "¿Dónde está mi reciclador?", "¿Cuál es mi impacto?", "Letra más grande"]


def info_proveedor() -> dict:
    return proveedor_activo().descripcion()
