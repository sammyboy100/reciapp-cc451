# Guía de instalación: ReciApp

Requisitos mínimos: una laptop convencional (4 GB de RAM) con **Python 3.11 o superior** y **Node.js 20 o superior**, o solo **Docker Desktop**. Navegador recomendado: **Chrome o Edge**, que soportan dictado por voz (Web Speech API). En Firefox la voz se reemplaza por el campo de texto.

## 1. Con Docker (recomendado)

```bash
docker compose up --build
```
| Servicio | URL |
|---|---|
| App (PWA) | http://localhost:4173 |
| API + Swagger | http://localhost:8000/docs |
| PostgreSQL | interno (`db:5432`) |

La primera vez, la API ejecuta `python -m app.seed` y carga los **datos simulados**. Para empezar de cero: `docker compose down -v`.

## 2. Sin Docker (SQLite, ideal para la demo)

### Backend
```bash
cd reciapp-backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```
Edita `.env`:
```
DATABASE_URL=sqlite:///./reciapp.db
SECRET_KEY=cualquier-cadena-larga
FRONTEND_URL=http://localhost:5173,http://localhost:4173
LLM_PROVIDER=local
```
```bash
python -m app.seed            # o: python -m app.seed --reset para recargar
uvicorn app.main:app --reload --host 0.0.0.0
```

### Frontend
```bash
cd reciapp-frontend
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:8000
npm run dev                   # desarrollo: http://localhost:5173
# PWA real (service worker activo):
npm run build && npm run preview   # http://localhost:4173
```

## 3. Probar en el celular (misma red Wi-Fi)
1. Averigua la IP de tu laptop (`ipconfig` o `ip a`), por ejemplo `192.168.1.50`.
2. Backend: añade `http://192.168.1.50:4173` a `FRONTEND_URL` y levanta uvicorn con `--host 0.0.0.0`.
3. Frontend: `VITE_API_URL=http://192.168.1.50:8000`, y luego `npm run build && npm run preview`.
4. En el celular abre `http://192.168.1.50:4173`.

> El micrófono y la instalación de la PWA exigen **HTTPS** o `localhost`. En el celular puedes usar `chrome://flags/#unsafely-treat-insecure-origin-as-secure` con la IP de la laptop, o un túnel HTTPS (por ejemplo `cloudflared tunnel --url http://localhost:4173`).

## 4. Instalar la PWA
- **Chrome/Edge (escritorio y Android):** aparece la tarjeta "Instala ReciApp", o usa el menú → *Instalar aplicación*.
- **iOS Safari:** Compartir → *Agregar a pantalla de inicio*.
- Prueba offline: con la app abierta, DevTools → Network → *Offline*. La app sigue abriendo y muestra lo último que cargó.

## 5. Elegir el proveedor de LLM
| `LLM_PROVIDER` | Requiere | Notas |
|---|---|---|
| `local` (defecto) | nada | NLU por reglas en español peruano, sin internet |
| `ollama` | [Ollama](https://ollama.com) + `ollama pull llama3.2:3b` | LLM 100 % local. `LLM_BASE_URL=http://localhost:11434/v1`. Con Docker: `docker compose --profile llm-local up` dentro de `reciapp-backend/` |
| `openai` / `groq` / `openrouter` | `LLM_API_KEY` | API compatible con OpenAI |
| `anthropic` | `LLM_API_KEY` | API Messages |
| `gemini` | `LLM_API_KEY` | API generateContent |

Si el proveedor remoto falla (sin red, sin cuota), el asistente sigue funcionando con el NLU local y la interfaz lo indica como "(respaldo)".

## 6. Pruebas
```bash
cd reciapp-backend && pip install -r requirements-dev.txt && pytest -q
```

## 7. Problemas frecuentes
| Síntoma | Solución |
|---|---|
| "No pude acceder al micrófono" | Da permiso de micrófono al sitio; usa Chrome/Edge en `localhost` o HTTPS |
| Error de CORS | Agrega el origen exacto del frontend a `FRONTEND_URL` (separado por comas) |
| El mapa se ve gris | No hay internet para las teselas de OpenStreetMap; el resto de la app funciona |
| `npm install` falla por dependencias peer | Usa Node 20 o superior; el proyecto fija `@vitejs/plugin-react@5`, compatible con Vite 8 |
