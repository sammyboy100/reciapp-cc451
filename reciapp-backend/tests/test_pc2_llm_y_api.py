"""PC2 · Capa LLM intercambiable + endpoints de asistente, perfil y salas."""
import pytest
from fastapi.testclient import TestClient

from app.llm.base import LLMError, LLMProvider, Mensaje, RespuestaLLM
from app.llm.factory import completar_con_respaldo, crear_proveedor


class ProveedorCaido(LLMProvider):
    nombre = "caido"

    def completar(self, *a, **k):
        raise LLMError("sin red")


def test_factory_conoce_todos_los_proveedores():
    for n in ["local", "openai", "groq", "ollama", "anthropic", "gemini", "openrouter"]:
        assert crear_proveedor(n).nombre == n
    with pytest.raises(ValueError):
        crear_proveedor("inexistente")


def test_respaldo_local_si_el_remoto_falla():
    resp, respaldo = completar_con_respaldo([Mensaje("user", "reciclar 2 kg de papel")], ProveedorCaido())
    assert respaldo is True and resp.proveedor == "local"
    assert '"papel"' in resp.texto


@pytest.fixture(scope="module")
def client():
    from app.db.session import engine
    from app.seed import seed
    engine.dispose()   # otras suites pueden haber dejado conexiones abiertas
    seed(reset=True)
    from app.main import app
    with TestClient(app) as c:
        yield c


def _login(client, correo):
    r = client.post("/auth/login", data={"username": correo, "password": "Reciapp2026!"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_asistente_autocompleta_con_perfil(client):
    h = _login(client, "lucia@reciapp.pe")
    r = client.post("/api/asistente/chat", headers=h, json={"mensaje": "quiero reciclar 4 kilos de papel", "canal": "voz"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["intencion"] == "crear_solicitud"
    assert body["accion"]["tipo"] == "confirmar_solicitud"
    assert body["borrador"]["franja_horaria"] == "tarde"          # aprendido del historial
    assert "direccion" in body["accion"]["autocompletado"]
    assert body["proveedor"] == "local"


def test_asistente_pregunta_lo_que_falta_y_retoma_borrador(client):
    h = _login(client, "carlos@reciapp.pe")
    r1 = client.post("/api/asistente/chat", headers=h, json={"mensaje": "quiero reciclar vidrio"}).json()
    assert r1["accion"] == {"tipo": "preguntar", "campo": "cantidad_kg"}
    r2 = client.post("/api/asistente/chat", headers=h,
                     json={"mensaje": "unos 6 kilos", "borrador": r1["borrador"]}).json()
    assert r2["accion"]["tipo"] == "confirmar_solicitud"
    assert r2["borrador"]["tipos"] == ["vidrio"] and r2["borrador"]["cantidad_kg"] == 6


def test_comando_de_voz_de_accesibilidad(client):
    h = _login(client, "miguel@reciapp.pe")
    r = client.post("/api/asistente/chat", headers=h, json={"mensaje": "pon la letra más grande", "canal": "voz"}).json()
    assert r["accion"]["tipo"] == "aplicar_preferencias"
    perfil = client.get("/api/perfil-adaptativo/me", headers=h).json()
    assert perfil["preferencias"]["tamano_fuente"] in {"grande", "muy_grande"}


def test_frustracion_cambia_el_tono(client):
    h = _login(client, "jorge@reciapp.pe")
    r = client.post("/api/asistente/chat", headers=h, json={"mensaje": "no funciona, estoy harto"}).json()
    assert r["emocion_detectada"] == "frustracion"
    assert r["tono"] == "empatico"


def test_impacto_y_nivel(client):
    h = _login(client, "ana@reciapp.pe")
    imp = client.get("/api/perfil-adaptativo/me/impacto", headers=h).json()
    assert imp["kg_total"] == 110 and imp["nivel"]["nombre"] == "Árbol"


def test_salas_flujo_colaborativo(client):
    h_jorge = _login(client, "jorge@reciapp.pe")
    h_ana = _login(client, "ana@reciapp.pe")
    nueva = client.post("/api/salas", headers=h_ana, json={"nombre": "Mercado Modelo", "meta_kg": 50}).json()
    assert len(nueva["codigo"]) == 6 and nueva["soy_miembro"]
    unida = client.post("/api/salas/unirse", headers=h_jorge, json={"codigo": nueva["codigo"].lower()}).json()
    assert unida["miembros_count"] == 2
    m = client.post(f"/api/salas/{nueva['id']}/mensajes", headers=h_jorge, json={"contenido": "¡Hola!"}).json()
    r = client.post(f"/api/salas/{nueva['id']}/mensajes/{m['id']}/reacciones", headers=h_ana, json={"emoji": "💚"}).json()
    assert r["reacciones"]["💚"] == [unida["creador_id"]]
    det = client.get(f"/api/salas/{nueva['id']}", headers=h_ana).json()
    assert [x["contenido"] for x in det["mensajes"]][-1] == "¡Hola!"


def test_sala_privada_requiere_codigo(client):
    h = _login(client, "carlos@reciapp.pe")
    publicas = client.get("/api/salas/explorar", headers=h).json()
    assert "ALAM26" not in [s["codigo"] for s in publicas]
    privada_id = 3
    assert client.post(f"/api/salas/{privada_id}/unirse", headers=h).status_code == 403
    assert client.post("/api/salas/unirse", headers=h, json={"codigo": "ALAM26"}).json()["soy_miembro"]
