# ReciApp: Frontend (React + Vite, PWA)

```bash
npm install
cp .env.example .env     # VITE_API_URL=http://localhost:8000
npm run dev              # desarrollo
npm run build && npm run preview   # PWA con service worker
```

Piezas de la PC2: `src/hooks/useVoz.js` (STT/TTS), `src/components/Reci/` (asistente y mascota), `src/context/PerfilContext.jsx` (personalización continua), `src/pages/Salas.jsx` y `SalaDetalle.jsx` (multiusuario), `src/components/Emocion/` (diseño emocional), `public/sw.js` y `public/manifest.webmanifest` (PWA).

Guía completa en el [README raíz](../README.md). Licencia MIT.
