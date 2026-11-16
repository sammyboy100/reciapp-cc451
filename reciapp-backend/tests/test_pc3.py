"""PC3 · Jornadas compartidas, SUS, métricas y evaluación del NLU."""
import pytest
from fastapi.testclient import TestClient

from app.evaluacion_nlu import evaluar
from app.services.usabilidad import adjetivo_sus, agregar_eventos, puntaje_sus


def test_sus_puntaje_extremos_y_tipico():
    assert puntaje_sus([5, 1] * 5) == 100
    assert puntaje_sus([1, 5] * 5) == 0
    assert puntaje_sus([3] * 10) == 50
    assert adjetivo_sus(80) == "Bueno"
    with pytest.raises(ValueError):
        puntaje_sus([6] * 10)


def test_agregar_eventos_mediana_por_canal():
    m = agregar_eventos([
        {"tipo": "solicitud_creada", "datos": {"canal": "voz", "duracion_seg": 40}},
        {"tipo": "solicitud_creada", "datos": {"canal": "voz", "duracion_seg": 50}},
        {"tipo": "error", "datos": {"contexto": "mapa"}},
    ])
    assert m["mediana_seg_por_canal"]["voz"] == 45
    assert m["errores_por_solicitud"] == 0.5


def test_nlu_no_retrocede():
    """Guardia de regresión: la versión 2 no puede empeorar en desarrollo ni en prueba."""
    assert evaluar("desarrollo")["precision_intencion"] >= 0.95
    assert evaluar("prueba")["precision_intencion"] >= 0.80
    assert evaluar()["precision_slots"] >= 0.95


@pytest.fixture(scope="module")
def client():
    from app.db.session import engine
    from app.seed import seed
    engine.dispose()
    seed(reset=True)
    from app.main import app
    with TestClient(app) as c:
        yield c


def _login(c, correo):
    r = c.post("/auth/login", data={"username": correo, "password": "Reciapp2026!"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_jornada_ciclo_completo(client):
    ana, jorge, pedro = _login(client, "ana@reciapp.pe"), _login(client, "jorge@reciapp.pe"), _login(client, "pedro.reciclador@reciapp.pe")
    sala = client.post("/api/salas", headers=ana, json={"nombre": "Mercado Unión", "meta_kg": 10}).json()
    client.post("/api/salas/unirse", headers=jorge, json={"codigo": sala["codigo"]})
    client.post("/api/salas/unirse", headers=pedro, json={"codigo": sala["codigo"]})
    j = client.post(f"/api/salas/{sala['id']}/jornadas", headers=ana, json={
        "titulo": "Cartón del mercado", "fecha": "2026-11-20", "franja_horaria": "tarde", "punto_encuentro": "Puerta 2"}).json()
    assert j["estado"] == "abierta"
    client.post(f"/api/salas/{sala['id']}/jornadas/{j['id']}/participar", headers=ana, json={"tipo_residuo": "carton", "cantidad_kg": 6})
    r = client.post(f"/api/salas/{sala['id']}/jornadas/{j['id']}/participar", headers=jorge, json={"tipo_residuo": "plastico", "cantidad_kg": 5}).json()
    assert r["kg_total"] == 11 and len(r["participantes"]) == 2
    assert client.post(f"/api/salas/{sala['id']}/jornadas/{j['id']}/tomar", headers=jorge).status_code == 403
    assert client.post(f"/api/salas/{sala['id']}/jornadas/{j['id']}/tomar", headers=pedro).json()["estado"] == "asignada"
    fin = client.post(f"/api/salas/{sala['id']}/jornadas/{j['id']}/completar", headers=pedro).json()
    assert fin["estado"] == "completada"
    det = client.get(f"/api/salas/{sala['id']}", headers=ana).json()
    assert det["kg_acumulados"] >= 11   # la sala suma todo lo completado por sus miembros
    textos = [m["contenido"] for m in det["mensajes"]]
    assert any("completada" in t for t in textos) and any("Meta cumplida" in t for t in textos)


def test_sus_y_metricas_admin(client):
    h = _login(client, "carlos@reciapp.pe")
    assert client.post("/api/usabilidad/sus", headers=h, json={"respuestas": [5, 1, 5, 1, 5, 1, 5, 1, 5, 1]}).json()["puntaje"] == 100
    assert client.get("/api/usabilidad/sus/me", headers=h).json()["respondido"]
    assert client.get("/api/usabilidad/metricas", headers=h).status_code == 403
    m = client.get("/api/usabilidad/metricas", headers=_login(client, "admin@reciapp.pe")).json()
    assert m["sus"]["n"] >= 7 and m["sus"]["simuladas"] == 6
    assert "voz" in m["uso"]["mediana_seg_por_canal"]
