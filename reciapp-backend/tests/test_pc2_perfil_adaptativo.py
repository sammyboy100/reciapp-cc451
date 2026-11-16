"""PC2 · Personalización continua."""
from datetime import datetime, timedelta, timezone

from app.services import perfil_adaptativo as pa

T0 = datetime(2026, 10, 13, 15, 0, tzinfo=timezone.utc)


def _sol(p, mat="plastico", franja="tarde", seg=None, t=T0):
    return pa.aplicar_evento(p, {"tipo": "solicitud_creada", "datos": {
        "tipo_residuo": mat, "franja_horaria": franja, "cantidad_kg": 4, "direccion": "Av. X 1",
        "duracion_seg": seg, "canal": "voz"}}, momento=t)


def test_aprende_material_franja_y_direccion():
    p = _sol(_sol(_sol(None), "papel"), "plastico", "manana")
    d = pa.derivar(p)
    assert d["material_frecuente"] == "plastico"
    assert d["franja_preferida"] == "tarde"
    assert d["direccion_habitual"] == "Av. X 1"
    assert d["canal_preferido"] == "voz"


def test_tres_errores_seguidos_infieren_frustracion_y_tono_empatico():
    p = None
    for i in range(3):
        p = pa.aplicar_evento(p, {"tipo": "error", "datos": {"contexto": "direccion"}},
                              momento=T0 + timedelta(seconds=30 * i))
    assert p["emociones"]["actual"] == "frustracion"
    d = pa.derivar(p)
    assert d["tono_asistente"] == "empatico"
    assert d["velocidad_voz"] <= 0.92
    assert d["nivel_guia"] == "guiado"


def test_errores_espaciados_no_frustran():
    p = None
    for i in range(3):
        p = pa.aplicar_evento(p, {"tipo": "error", "datos": {}}, momento=T0 + timedelta(minutes=10 * i))
    assert p["emociones"]["actual"] is None


def test_exito_enfria_frustracion_inferida():
    p = None
    for i in range(3):
        p = pa.aplicar_evento(p, {"tipo": "error", "datos": {}}, momento=T0)
    p = _sol(p)
    assert p["emociones"]["actual"] == "calma"


def test_ritmo_ajusta_velocidad_de_voz():
    rapido = _sol(None, seg=30)
    lento = _sol(None, seg=200)
    assert pa.derivar(rapido)["ritmo"] == "rapido"
    assert pa.derivar(lento)["velocidad_voz"] < pa.derivar(rapido)["velocidad_voz"]


def test_preferencia_explicita_gana_a_la_inferencia():
    p = pa.aplicar_evento(None, {"tipo": "preferencias", "datos": {"tono_preferido": "formal", "velocidad_voz": 1.3}})
    p = pa.aplicar_evento(p, {"tipo": "emocion", "datos": {"emocion": "alegria"}})
    d = pa.derivar(p)
    assert d["tono_asistente"] == "formal"
    assert d["velocidad_voz"] == 1.3


def test_perfil_viejo_se_completa_con_claves_nuevas():
    p = pa.normalizar({"preferencias": {"alto_contraste": True}})
    assert p["preferencias"]["alto_contraste"] is True
    assert "tamano_fuente" in p["preferencias"]
