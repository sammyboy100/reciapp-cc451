import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { PerfilProvider } from "./context/PerfilContext";
import { FeedbackProvider } from "./context/FeedbackContext";
// Fuentes empaquetadas (funcionan offline en la PWA)
import "@fontsource/dm-serif-display/400.css";
import "@fontsource/dm-serif-display/400-italic.css";
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/hanken-grotesk/700.css";
import "./index.css";
import "./styles/reciapp.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PerfilProvider>
          <FeedbackProvider>
            <App />
          </FeedbackProvider>
        </PerfilProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// PWA: service worker (solo en build de producción para no interferir con el HMR de Vite)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
