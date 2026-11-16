"""Carga los datos simulados de /datos_simulados en la base de datos.

Uso:
    python -m app.seed            # carga solo si la BD está vacía
    python -m app.seed --reset    # borra todo y vuelve a cargar

Todas las cuentas usan la contraseña indicada en usuarios.json (Reciapp2026!).
"""
from __future__ import annotations

import json
import os
import shutil
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from app.core.eco_creditos import calcular
from app.core.security import get_password_hash
from app.db.session import SessionLocal, engine
from app.models.base import Base
import app.models  # noqa: F401
from app.models.evidencia import Evidencia
from app.models.perfil import PerfilUsuario
from app.models.jornada import JornadaSala, ParticipanteJornada
from app.models.perfil import EventoInteraccion
from app.models.sala import MensajeSala, MiembroSala, Sala
from app.models.usabilidad import RespuestaSUS
from app.services.usabilidad import puntaje_sus
from app.models.solicitud import Solicitud
from app.models.user import Usuario
from app.services import perfil_adaptativo as pa

RAIZ = Path(__file__).resolve().parent.parent
DATOS = RAIZ / "datos_simulados"
UPLOADS = RAIZ / "uploads" / "evidencias"


def _cargar(nombre: str) -> dict:
    return json.loads((DATOS / nombre).read_text(encoding="utf-8"))


def _fusionar_perfil(base: dict, extra: dict) -> dict:
    out = pa.normalizar(base)
    for bloque, valores in extra.items():
        if isinstance(valores, dict) and isinstance(out.get(bloque), dict):
            out[bloque].update(valores)
    return out


def seed(reset: bool = False) -> None:
    if reset:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Usuario).count() and not reset:
            print("La base ya tiene datos. Usa --reset para recargar.")
            return

        # ── Usuarios ─────────────────────────────────────────────
        cfg = _cargar("usuarios.json")
        hash_comun = get_password_hash(cfg["contrasena_comun"])
        ids: dict[str, int] = {}
        for u in cfg["usuarios"]:
            es_rec = u["rol"] == "reciclador"
            obj = Usuario(
                nombre=u["nombre"], correo=u["correo"], dni=u.get("dni"), celular=u.get("celular"),
                contrasena=hash_comun, rol=u["rol"], verificado=True,
                activo=(u.get("estado_validacion") == "aprobado") if es_rec else True,
                zona_cobertura=u.get("zona_cobertura"), disponibilidad_horaria=u.get("disponibilidad_horaria"),
                estado_validacion=u.get("estado_validacion"), latitud=u.get("latitud"), longitud=u.get("longitud"),
                eco_creditos=0.0,
            )
            db.add(obj)
            db.flush()
            ids[u["ref"]] = obj.id

        # ── Solicitudes + evidencias ─────────────────────────────
        UPLOADS.mkdir(parents=True, exist_ok=True)
        fotos = sorted((DATOS / "fotos").glob("*.png"))
        perfiles: dict[str, dict] = {}
        hoy = date.today()
        for i, s in enumerate(_cargar("solicitudes.json")["solicitudes"]):
            fecha = hoy + timedelta(days=s["dias"])
            creada = datetime.combine(fecha - timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=14)
            sol = Solicitud(
                ciudadano_id=ids[s["ciudadano"]], tipo_residuo=s["tipo_residuo"], cantidad_kg=s["cantidad_kg"],
                fecha_recoleccion=fecha.isoformat(), franja_horaria=s["franja_horaria"], direccion=s["direccion"],
                latitud=s["latitud"], longitud=s["longitud"], estado=s["estado"],
                reciclador_id=ids.get(s["reciclador"]) if s.get("reciclador") else None,
                fecha_asignacion=creada + timedelta(minutes=20) if s.get("reciclador") else None,
                fecha_creacion=creada, fecha_actualizacion=creada + timedelta(hours=3),
            )
            db.add(sol)
            db.flush()
            if s.get("peso_real_kg") and s["estado"] in ("completada", "pendiente_confirmacion"):
                url = "/uploads/evidencias/placeholder.png"
                if fotos:
                    foto = fotos[i % len(fotos)]
                    shutil.copy(foto, UPLOADS / foto.name)
                    url = f"/uploads/evidencias/{foto.name}"
                ev = Evidencia(solicitud_id=sol.id, reciclador_id=sol.reciclador_id, foto_url=url,
                               peso_kg=s["peso_real_kg"], tipo_residuo=s["tipo_residuo"],
                               eco_creditos=calcular(s["tipo_residuo"], s["peso_real_kg"]))
                db.add(ev)
                if s["estado"] == "completada":
                    db.get(Usuario, sol.ciudadano_id).eco_creditos += ev.eco_creditos
            # El perfil aprende de cada solicitud histórica
            perfiles[s["ciudadano"]] = pa.aplicar_evento(perfiles.get(s["ciudadano"]), {
                "tipo": "solicitud_creada",
                "datos": {"tipo_residuo": s["tipo_residuo"], "cantidad_kg": s["cantidad_kg"],
                          "franja_horaria": s["franja_horaria"], "direccion": s["direccion"],
                          "latitud": s["latitud"], "longitud": s["longitud"]},
            }, momento=creada)

        # ── Perfiles adaptativos ─────────────────────────────────
        extra = _cargar("perfiles.json")["perfiles"]
        for ref, uid in ids.items():
            datos = _fusionar_perfil(perfiles.get(ref) or pa.perfil_por_defecto(), extra.get(ref, {}))
            db.add(PerfilUsuario(usuario_id=uid, datos=datos))

        # ── Salas colaborativas ──────────────────────────────────
        for sd in _cargar("salas.json")["salas"]:
            sala = Sala(nombre=sd["nombre"], descripcion=sd["descripcion"], codigo=sd["codigo"], tipo=sd["tipo"],
                        distrito=sd["distrito"], meta_kg=sd["meta_kg"], emoji=sd["emoji"], publica=sd["publica"],
                        creador_id=ids[sd["creador"]],
                        fecha_creacion=datetime.now(timezone.utc) - timedelta(days=45))
            db.add(sala)
            db.flush()
            for ref in sd["miembros"]:
                db.add(MiembroSala(sala_id=sala.id, usuario_id=ids[ref],
                                   rol="anfitrion" if ref == sd["creador"] else "miembro"))
            base = datetime.now(timezone.utc) - timedelta(days=len(sd["mensajes"]))
            for j, (tipo, autor, texto) in enumerate(sd["mensajes"]):
                reac = {"💚": [ids[sd["miembros"][0]]]} if tipo == "logro" else {}
                db.add(MensajeSala(sala_id=sala.id, usuario_id=ids[autor] if autor else None, tipo=tipo,
                                   contenido=texto, reacciones=reac, fecha=base + timedelta(hours=j * 7)))
            # Jornadas de recojo compartidas (PC3)
            for jd in sd.get("jornadas", []):
                jor = JornadaSala(sala_id=sala.id, creador_id=ids[sd["creador"]], titulo=jd["titulo"],
                                  fecha=(hoy + timedelta(days=jd["dias"])).isoformat(), franja_horaria=jd["franja_horaria"],
                                  punto_encuentro=jd["punto_encuentro"], latitud=jd["latitud"], longitud=jd["longitud"],
                                  estado=jd["estado"], reciclador_id=ids.get(jd["reciclador"]) if jd["reciclador"] else None)
                db.add(jor)
                db.flush()
                for ref, mat, kg in jd["participantes"]:
                    db.add(ParticipanteJornada(jornada_id=jor.id, usuario_id=ids[ref], tipo_residuo=mat, cantidad_kg=kg))
                    if jd["estado"] == "completada":
                        db.add(Solicitud(ciudadano_id=ids[ref], reciclador_id=jor.reciclador_id, tipo_residuo=mat,
                                         cantidad_kg=kg, fecha_recoleccion=jor.fecha, franja_horaria=jor.franja_horaria,
                                         direccion=jor.punto_encuentro, latitud=jor.latitud, longitud=jor.longitud,
                                         estado="completada"))

        # Encuesta SUS y eventos de uso simulados (para el panel de métricas)
        for ref, resp, com in _cargar("sus_simulado.json")["respuestas"]:
            canal = pa.derivar(_fusionar_perfil(perfiles.get(ref) or pa.perfil_por_defecto(), extra.get(ref, {})))["canal_preferido"]
            db.add(RespuestaSUS(usuario_id=ids[ref], respuestas=resp, puntaje=puntaje_sus(resp), comentario=com,
                                canal_principal=canal, simulada=1))
        for ref, tipo, datos in _cargar("eventos_simulados.json")["eventos"]:
            db.add(EventoInteraccion(usuario_id=ids[ref], tipo=tipo, datos=datos))

        db.commit()
        print(f"Datos simulados cargados: {len(ids)} usuarios, "
              f"{db.query(Solicitud).count()} solicitudes, {db.query(Sala).count()} salas.")
        print(f"Contraseña de todas las cuentas: {cfg['contrasena_comun']}")
    finally:
        db.close()


if __name__ == "__main__":
    os.chdir(RAIZ)
    seed(reset="--reset" in sys.argv)
