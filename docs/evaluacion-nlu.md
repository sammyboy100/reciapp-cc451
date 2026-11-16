# Evaluación del NLU de Reci

Corpus: **80 frases** etiquetadas a mano (`reciapp-backend/datos_simulados/corpus_nlu.json`): 60 de **desarrollo** (usadas para ajustar las reglas) y 20 de **prueba** (escritas aparte, nunca usadas para ajustar).

| Conjunto | Precisión de intención | Precisión de slots |
|---|---|---|
| Desarrollo, versión 1 (antes de ajustar) | 93.3 % | 100.0 % |
| Desarrollo, versión 2 (después de ajustar) | 100.0 % | 100.0 % |
| **Prueba (generalización)** | **80.0 %** | **100.0 %** |

La cifra que cuenta para el criterio de usabilidad (≥ 85 %) es la del conjunto de **prueba**.

## Total (80 frases)

| Métrica | Resultado | Meta (criterio de usabilidad) |
|---|---|---|
| Precisión de intención | **95.0 %** | ≥ 85 % |
| Precisión de slots (60 slots) | **100.0 %** | — |

## Por intención

| Intención | Aciertos |
|---|---|
| ayuda | 3/3 |
| cancelar | 2/3 |
| como_reciclar | 7/7 |
| confirmar | 3/3 |
| crear_solicitud | 26/26 |
| despedida | 1/1 |
| disponibles | 2/3 |
| emocion | 4/4 |
| impacto | 5/5 |
| perfil | 5/5 |
| salas | 5/5 |
| saludo | 3/3 |
| seguimiento | 5/7 |
| ver_solicitudes | 5/5 |

## Casos con error

- #67 «en qué va mi recojo, ya llegó?» → esperada `seguimiento`, obtenida `crear_solicitud`
- #68 «dónde anda el que recoge» → esperada `seguimiento`, obtenida `crear_solicitud`
- #76 «no, olvídalo» → esperada `cancelar`, obtenida `desconocido`
- #80 «hay recojos pendientes para mí?» → esperada `disponibles`, obtenida `crear_solicitud`

Reproducir: `cd reciapp-backend && python -m app.evaluacion_nlu --markdown`
