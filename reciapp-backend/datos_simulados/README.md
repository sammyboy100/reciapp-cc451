# Datos simulados

Todos los datos son **ficticios**. Se cargan con `python -m app.seed` (o `--reset` para recargar).

| Archivo | Contenido |
|---|---|
| `usuarios.json` | 12 cuentas (6 ciudadanos con personas distintas, incluidas personas con discapacidad; 5 recicladores, 3 aprobados y 2 pendientes; 1 admin). Contraseña común: `Reciapp2026!` |
| `solicitudes.json` | 25 solicitudes en Puente Piedra en todos los estados. Las fechas son relativas al día de carga (`dias`) |
| `salas.json` | 3 salas (barrio, colegio y condominio privado) con miembros y mensajes |
| `perfiles.json` | Preferencias de accesibilidad, ritmo, canal y emoción de cada persona. Materiales, franjas y dirección se aprenden del historial de solicitudes |
| `fotos/` | Imágenes de evidencia de recolección |
