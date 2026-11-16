# Estado del prototipo · PC3 (11/11/2026)

## Pantallas: 19 completas + 1 parcial de 25 (78 %)

| # | Pantalla | Rol | Estado | Evidencia |
|---|---|---|---|---|
| 1 | Splash | Todos | ✅ | video PC2 |
| 2 | Login | Todos | ✅ | `evidencias-pc3/01-login.png` |
| 3 | Registro de ciudadano | Ciudadano | ✅ | `23-registro.png` |
| 4 | Registro de reciclador | Reciclador | ✅ | `/register/reciclador` |
| 5 | Inicio del ciudadano (voz, check-in, «lo de siempre», impacto) | Ciudadano | ✅ | `02-inicio.png` |
| 6 | Nueva solicitud (4 pasos) | Ciudadano | ✅ | `04-modal-paso4.png` |
| 7 | Asistente Reci (voz + LLM) | Ciudadano/Reciclador | ✅ | `03-reci-borrador.png` |
| 8 | Mis solicitudes | Ciudadano | ✅ | `05-mis-solicitudes.png` |
| 9 | Seguimiento en vivo | Ciudadano | ✅ | `24-seguimiento.png` |
| 10 | Confirmar recepción | Ciudadano | ✅ | `25-por-confirmar.png` |
| 11 | Salas (crear, unirse, explorar) | Ciudadano/Reciclador | ✅ | `06-salas.png` |
| 12 | Sala: chat, reacciones, ranking | Ciudadano/Reciclador | ✅ | `07-sala-jornadas.png` |
| 13 | **Jornadas de recojo compartidas** (nuevo) | Ciudadano/Reciclador | ✅ | `08`, `09`, `17` |
| 14 | Perfil, voz y accesibilidad (+ notificaciones) | Todos | ✅ | `10-perfil.png` |
| 15 | **Encuesta SUS** (nuevo) | Ciudadano/Reciclador | ✅ | `11`–`13` |
| 16 | Estado sin conexión y cola offline (nuevo) | Ciudadano | ✅ | `14`, `15` |
| 17 | Panel del reciclador | Reciclador | ✅ | `16-reciclador.png` |
| 18 | Navegación a domicilio + evidencia | Reciclador | ✅ | heredado v2 |
| 19 | **Métricas de usabilidad** (nuevo) | Admin | ✅ | `18-admin-metricas.png` |
| 20 | Panel admin (validar recicladores) | Admin | 🟡 los KPIs de cabecera aún son estáticos | `26-admin-panel.png` |
| 21 | Centros de acopio (mapa) | Ciudadano | ⬜ pendiente | — |
| 22 | Canje de eco-créditos | Ciudadano | ⬜ pendiente | — |
| 23 | Historial de notificaciones | Todos | ⬜ pendiente | — |
| 24 | Tutorial de primer uso | Todos | ⬜ pendiente | — |
| 25 | Historial de ganancias del reciclador | Reciclador | ⬜ pendiente | — |

## Módulos

| Módulo | Avance | Notas |
|---|---|---|
| Autenticación y roles | 100 % | JWT, validación de recicladores |
| Solicitudes, asignación y ruteo | 100 % | heredado v2 |
| Seguimiento en vivo (WebSocket) | 100 % | |
| Evidencias y eco-créditos | 90 % | falta el canje |
| Asistente Reci (voz + capa LLM) | 90 % | 7 proveedores; NLU con 80 % de precisión en el conjunto de prueba (meta 85 %) |
| Perfil adaptativo | 100 % | |
| Salas + jornadas compartidas | 100 % | |
| PWA: offline, cola de acciones, instalación | 90 % | Web Push con servidor (VAPID) pendiente |
| Notificaciones del sistema | 70 % | funcionan con la app abierta o en segundo plano; sin servidor push |
| Evaluación de usabilidad (SUS + métricas) | 80 % | instrumento listo; faltan las pruebas con usuarios reales |
| Accesibilidad | 90 % | axe: de 160 a 1 nodos con violación; falta la revisión manual con lector de pantalla |
| Centros de acopio y canje | 0 % | siguiente iteración |

**Avance global estimado: ~80 %**, ponderando los módulos por su número de requerimientos.
