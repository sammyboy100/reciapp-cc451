# ReciApp: Backend (FastAPI)

API REST + WebSocket. Incluye la **capa de abstracción LLM** (`app/llm`), el **asistente Reci** (`app/services/asistente.py`), el **perfil adaptativo** (`app/services/perfil_adaptativo.py`) y las **salas colaborativas** (`app/api/v1/salas.py`).

```bash
pip install -r requirements.txt
cp .env.example .env          # DATABASE_URL=sqlite:///./reciapp.db para correr sin PostgreSQL
python -m app.seed            # datos simulados
uvicorn app.main:app --reload # http://localhost:8000/docs
pytest -q                     # pruebas
```

Endpoints nuevos (PC2): `POST /api/asistente/chat`, `GET /api/asistente/proveedor`, `GET|PUT /api/perfil-adaptativo/me[/preferencias]`, `POST /api/perfil-adaptativo/eventos`, `GET /api/perfil-adaptativo/me/impacto`, `GET|POST /api/salas`, `POST /api/salas/unirse`, `GET /api/salas/{id}`, `POST /api/salas/{id}/mensajes`, `POST /api/salas/{id}/mensajes/{mid}/reacciones`. Por WebSocket: `sala_mensaje`, `sala_reaccion`, `sala_escribiendo`, `sala_meta_alcanzada`.

Guía completa en el [README raíz](../README.md) y en [docs/INSTALACION.md](../docs/INSTALACION.md). Licencia MIT.
