# Arquitectura: modelo C4

Los diagramas renderizados están en [`docs/arquitectura/`](arquitectura/) (PNG/SVG, generados con Graphviz desde los `.dot`). Abajo va la versión en Mermaid, que GitHub muestra directamente.

## Nivel 1: Contexto
![C4 contexto](arquitectura/c4-1-contexto.png)

```mermaid
C4Context
  title ReciApp: diagrama de contexto
  Person(ciu, "Ciudadano", "Programa recojos por voz o toque; incluye adultos mayores y personas con discapacidad")
  Person(rec, "Reciclador", "Toma solicitudes y registra evidencias")
  Person(adm, "Administrador", "Valida recicladores")
  System(app, "ReciApp", "PWA con asistente de voz, perfil adaptativo y salas")
  System_Ext(llm, "Proveedor LLM", "OpenAI, Groq, Anthropic, Gemini u Ollama local")
  System_Ext(osm, "OpenStreetMap", "Teselas y grafo vial")
  System_Ext(speech, "Web Speech API", "STT/TTS del navegador")
  Rel(ciu, app, "Usa", "HTTPS/WSS")
  Rel(rec, app, "Usa", "HTTPS/WSS")
  Rel(adm, app, "Administra", "HTTPS")
  Rel(app, llm, "Interpreta y redacta", "HTTPS/JSON")
  Rel(app, osm, "Mapas y rutas", "HTTPS")
  Rel(app, speech, "Voz es-PE")
```

## Nivel 2: Contenedores
![C4 contenedores](arquitectura/c4-2-contenedores.png)

```mermaid
C4Container
  title ReciApp: contenedores
  Person(u, "Ciudadano / Reciclador")
  System_Boundary(b, "ReciApp") {
    Container(pwa, "PWA", "React 18 + Vite", "UI, Reci, voz, perfil, salas")
    Container(sw, "Service Worker", "JS", "Caché y modo offline")
    Container(api, "API REST + WebSocket", "FastAPI", "Negocio, asistente, perfil, salas")
    Container(llm, "Capa LLM", "Python", "Fábrica de proveedores + NLU local")
    ContainerDb(db, "Base de datos", "PostgreSQL / SQLite", "Usuarios, solicitudes, perfiles JSON, salas")
  }
  System_Ext(ext, "Proveedor LLM")
  Rel(u, pwa, "Usa")
  Rel(pwa, sw, "Registra")
  Rel(pwa, api, "REST + WebSocket")
  Rel(api, llm, "completar()")
  Rel(llm, ext, "HTTPS")
  Rel(api, db, "SQLAlchemy")
```

## Nivel 3: Componentes de la API
![C4 componentes](arquitectura/c4-3-componentes.png)

## Decisiones de diseño
| Decisión | Motivo |
|---|---|
| **El NLU local siempre corre**, aunque haya un LLM remoto | Respuesta determinista para los *slots* (material, kg, día, franja), el sistema sigue funcionando sin internet o sin cuota, y no hay costo en la demo. |
| **El LLM debe devolver JSON** con `intencion`, `slots`, `emocion` y `respuesta` | Lo validamos y lo fusionamos con el NLU. Si el JSON es inválido, se usa el NLU sin romper el flujo. |
| **Perfil como documento JSON** + función pura `aplicar_evento` | Esquema evolutivo (se completan las claves nuevas) y comportamiento adaptativo 100 % testeable. |
| **STT/TTS en el navegador** | Sin costo ni latencia de servidor y con privacidad (el audio no sale del dispositivo en Chrome con reconocimiento local). Si no hay soporte, hay alternativa por texto. |
| **WebSocket único por usuario** reutilizado para tracking y salas | Menos conexiones; el gestor ya soporta varias pestañas. |
| **SQLite opcional** | La app corre en cualquier laptop sin instalar PostgreSQL (Nota 2 del enunciado). |
