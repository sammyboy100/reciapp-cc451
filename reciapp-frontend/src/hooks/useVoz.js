import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Interfaz de voz del navegador (Web Speech API):
 *  - escuchar(): reconocimiento de voz (STT) en es-PE con resultados parciales.
 *  - hablar(texto): síntesis de voz (TTS) con la velocidad del perfil adaptativo.
 * Si el navegador no soporta STT (Firefox), `soportaSTT` es false y la UI
 * ofrece el campo de texto como alternativa equivalente.
 */
const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

function elegirVoz() {
  const voces = window.speechSynthesis?.getVoices?.() || [];
  return (
    voces.find((v) => v.lang === "es-PE") ||
    voces.find((v) => v.lang === "es-US" || v.lang === "es-419" || v.lang === "es-MX") ||
    voces.find((v) => v.lang?.startsWith("es")) ||
    null
  );
}

export function useVoz({ idioma = "es-PE", velocidad = 1 } = {}) {
  const [escuchando, setEscuchando] = useState(false);
  const [hablando, setHablando] = useState(false);
  const [parcial, setParcial] = useState("");
  const [error, setError] = useState(null);
  const [nivel, setNivel] = useState(0);           // 0–1 volumen del micrófono (para la onda)
  const recRef = useRef(null);
  const audioRef = useRef(null);
  const velRef = useRef(velocidad);
  useEffect(() => { velRef.current = velocidad; }, [velocidad]);

  const soportaSTT = Boolean(SR);
  const soportaTTS = typeof window !== "undefined" && "speechSynthesis" in window;

  const detenerMedidor = () => {
    const a = audioRef.current;
    if (!a) return;
    cancelAnimationFrame(a.raf);
    a.stream?.getTracks().forEach((t) => t.stop());
    a.ctx?.close?.();
    audioRef.current = null;
    setNivel(0);
  };

  // Medidor de volumen: retroalimentación visual mientras el usuario habla
  const iniciarMedidor = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      const a = { stream, ctx, raf: 0 };
      const loop = () => {
        an.getByteFrequencyData(buf);
        const avg = buf.reduce((s, v) => s + v, 0) / buf.length;
        setNivel(Math.min(1, avg / 90));
        a.raf = requestAnimationFrame(loop);
      };
      loop();
      audioRef.current = a;
    } catch { /* sin permiso de micrófono: la onda queda quieta */ }
  };

  const escuchar = useCallback(() => new Promise((resolve) => {
    if (!SR) { setError("no_soportado"); resolve(""); return; }
    window.speechSynthesis?.cancel();
    const rec = new SR();
    rec.lang = idioma;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let final = "";
    rec.onresult = (e) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) {
        txt += e.results[i][0].transcript;
        if (e.results[i].isFinal) final = txt;
      }
      setParcial(txt);
    };
    rec.onerror = (e) => setError(e.error);
    rec.onend = () => {
      setEscuchando(false);
      detenerMedidor();
      resolve((final || "").trim());
      setTimeout(() => setParcial(""), 400);
    };
    recRef.current = rec;
    setError(null);
    setParcial("");
    setEscuchando(true);
    if (navigator.vibrate) navigator.vibrate(30);
    iniciarMedidor();
    try { rec.start(); } catch { setEscuchando(false); resolve(""); }
  }), [idioma]);

  const detener = useCallback(() => { recRef.current?.stop(); }, []);

  const hablar = useCallback((texto, opciones = {}) => new Promise((resolve) => {
    if (!soportaTTS || !texto) { resolve(); return; }
    window.speechSynthesis.cancel();
    // Quitar emojis para que no se lean literalmente
    const limpio = texto.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").replace(/«|»/g, "");
    const u = new SpeechSynthesisUtterance(limpio);
    u.lang = idioma;
    u.rate = opciones.velocidad ?? velRef.current ?? 1;
    u.pitch = opciones.tono ?? 1.05;
    const voz = elegirVoz();
    if (voz) u.voice = voz;
    u.onstart = () => setHablando(true);
    u.onend = u.onerror = () => { setHablando(false); resolve(); };
    window.speechSynthesis.speak(u);
  }), [idioma, soportaTTS]);

  const callar = useCallback(() => { window.speechSynthesis?.cancel(); setHablando(false); }, []);

  useEffect(() => () => { recRef.current?.abort?.(); detenerMedidor(); window.speechSynthesis?.cancel(); }, []);

  return { soportaSTT, soportaTTS, escuchando, hablando, parcial, error, nivel, escuchar, detener, hablar, callar };
}
