# Auditoría de accesibilidad automática (axe-core 4.10, WCAG 2.1 A/AA)

Herramienta: axe-core inyectado con Playwright en 9 pantallas reales de la app con datos simulados. Script: `docs/accesibilidad/auditoria_axe.py`.

| Pantalla | Nodos con violación · antes (PC2) | Después (PC3) |
|---|---|---|
| Login | 9 | 0 |
| Inicio ciudadano | 24 | 0 |
| Mis solicitudes | 18 | 0 |
| Salas | 16 | 0 |
| Sala + jornadas | 33 | 0 |
| Perfil y accesibilidad | 21 | 0 |
| Encuesta SUS | 11 | 0 |
| Panel reciclador | 18 | 1 |
| Métricas admin | 10 | 0 |
| **Total** | **160** | **1** |

## Qué se corrigió

- **Contraste de color (1.4.3):** el verde de marca pasó de `oklch(0.66 0.15 142)` (2,9:1 con texto blanco) a `oklch(0.55 0.15 142)` (4,6:1). Naranja, rosa y azul se oscurecieron al mismo nivel. Los tonos claros de texto sobre verde se reemplazaron por blanco.
- **Estado «En camino»:** el badge usaba verde claro con texto blanco (2,2:1); ahora usa el verde profundo.
- **Navegación activa:** el fondo translúcido se cambió por verde profundo.
- **ARIA (4.1.2):** las barras de progreso y la fecha de jornada eran `div` con `aria-label` sin rol; ahora tienen `role="progressbar"` (con valores) o `role="img"`.
- **Chips de papel (amarillo):** usan texto oscuro en lugar de blanco.

## Pendiente

- 1 nodo en el panel del reciclador: el botón «Tomar» en estado inactivo (gris). WCAG 1.4.3 exime a los componentes inactivos, pero lo marcaremos con `aria-disabled` en la siguiente iteración.
- Las pruebas automáticas cubren cerca del 30–40 % de los criterios WCAG; falta la revisión manual con lector de pantalla (TalkBack/NVDA) planificada para las pruebas con usuarios.
