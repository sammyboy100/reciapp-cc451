"""PC2 · NLU local (respaldo y proveedor offline de la capa LLM)."""
from datetime import date

from app.llm import nlu

LUNES = date(2026, 10, 12)


def test_pedido_completo_por_voz():
    a = nlu.analizar("Quiero reciclar 3 kilos de botellas de plástico mañana por la tarde", hoy=LUNES)
    assert a["intencion"] == "crear_solicitud"
    assert a["slots"]["tipos"] == ["plastico"]
    assert a["slots"]["cantidad_kg"] == 3
    assert a["slots"]["dia_offset"] == 1
    assert a["slots"]["franja_horaria"] == "tarde"
    assert a["slots"]["fecha_recoleccion"] == "2026-10-13"


def test_la_manana_es_franja_no_dia():
    a = nlu.analizar("recojan mis cajas hoy en la mañana", hoy=LUNES)
    assert a["slots"]["dia_offset"] == 0
    assert a["slots"]["franja_horaria"] == "manana"
    assert a["slots"]["tipos"] == ["carton"]


def test_numeros_en_palabras_y_bolsas():
    assert nlu.extraer_cantidad_kg("cinco kilos") == 5
    assert nlu.extraer_cantidad_kg("dos y medio kilos") == 2.5
    assert nlu.extraer_cantidad_kg("tengo 2 bolsas") == 6


def test_frase_larga_tiene_prioridad():
    assert nlu.extraer_materiales("botellas de vidrio y latas") == ["vidrio", "metal"]


def test_consulta_no_es_pedido():
    assert nlu.analizar("¿se recicla el vidrio roto?")["intencion"] == "como_reciclar"


def test_emocion_frustracion():
    assert nlu.analizar("otra vez no funciona, estoy harto")["emocion"] == "frustracion"


def test_dia_de_semana():
    assert nlu.extraer_dia_offset("el viernes", hoy=LUNES) == 4


def test_confirmar_y_seguimiento():
    assert nlu.analizar("sí, dale")["intencion"] == "confirmar"
    assert nlu.analizar("¿dónde está mi reciclador?")["intencion"] == "seguimiento"
