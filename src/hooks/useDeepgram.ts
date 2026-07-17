// ============================================================================
// useDeepgram — transcripción PREMIUM en vivo con Deepgram (nova-2, español).
//
// Por qué existe: la Web Speech API del navegador es gratis pero floja con
// llamadas telefónicas en altavoz (ruido, dos voces, jerga). Deepgram nova-2
// transcribe muchísimo mejor ese audio. El navegador nunca ve la master key:
// pide un token temporal a la Edge Function `deepgram-token` y abre el WS con
// `?access_token=JWT`.
//
// Interfaz idéntica a useSpeech + `available`, para que CopilotPage cambie de
// motor sin tocar nada más. Si Deepgram no está configurado o el navegador no
// puede capturar audio → `available=false` y la página cae a Web Speech.
// ============================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/deepgram-token`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// nova-2 tiene soporte de español sólido con language=es. Cambiable aquí si en
// el futuro se quiere nova-3 multilingüe (language=multi).
const DG_MODEL = 'nova-2';

export interface UseDeepgramOptions {
  lang?: string; // 'es-EC', 'es-MX'… (se usa solo la parte de idioma: 'es')
  onFinal: (text: string) => void;
}

interface TokenResponse {
  available: boolean;
  access_token?: string;
  expires_in?: number;
  error?: string;
}

async function fetchToken(probe: boolean): Promise<TokenResponse> {
  if (!supabase) return { available: false };
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return { available: false };
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ probe }),
  });
  if (!res.ok) return { available: false };
  return (await res.json()) as TokenResponse;
}

const browserCanCapture = (): boolean =>
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== 'undefined' &&
  typeof WebSocket !== 'undefined';

export function useDeepgram({ lang = 'es-EC', onFinal }: UseDeepgramOptions) {
  const [supported] = useState(browserCanCapture);
  const [available, setAvailable] = useState<boolean | null>(null); // null = probando
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');

  const activeRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  // Probe de disponibilidad al montar (no gasta token: solo consulta config).
  useEffect(() => {
    let alive = true;
    if (!supported) {
      setAvailable(false);
      return;
    }
    fetchToken(true)
      .then((r) => alive && setAvailable(r.available))
      .catch(() => alive && setAvailable(false));
    return () => {
      alive = false;
    };
  }, [supported]);

  const teardown = useCallback(() => {
    try {
      recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop();
    } catch { /* noop */ }
    recorderRef.current = null;
    try {
      wsRef.current?.close();
    } catch { /* noop */ }
    wsRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (activeRef.current || !supported) return;
    activeRef.current = true;
    try {
      const tk = await fetchToken(false);
      if (!activeRef.current) return; // se canceló mientras pedíamos el token
      if (!tk.available || !tk.access_token) {
        setAvailable(false);
        activeRef.current = false;
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!activeRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;

      const language = lang.split('-')[0] || 'es';
      const params = new URLSearchParams({
        model: DG_MODEL,
        language,
        smart_format: 'true',
        punctuate: 'true',
        interim_results: 'true',
        // El JWT temporal por query param es lo más robusto en el navegador
        // (evita el límite de longitud del header Sec-WebSocket-Protocol).
        access_token: tk.access_token,
      });
      const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params.toString()}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!activeRef.current) {
          ws.close();
          return;
        }
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
        const rec = new MediaRecorder(stream, { mimeType: mime });
        recorderRef.current = rec;
        rec.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data);
        };
        rec.start(250); // enviar audio cada 250ms
        setListening(true);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as {
            type?: string;
            is_final?: boolean;
            channel?: { alternatives?: Array<{ transcript?: string }> };
          };
          if (msg.type && msg.type !== 'Results') return;
          const text = msg.channel?.alternatives?.[0]?.transcript?.trim() ?? '';
          if (!text) return;
          if (msg.is_final) {
            onFinalRef.current(text);
            setInterim('');
          } else {
            setInterim(text);
          }
        } catch { /* keep-alive / metadata: ignorar */ }
      };

      ws.onerror = () => {
        // El fallo se maneja en onclose (evita marcar no-disponible dos veces).
      };
      ws.onclose = () => {
        if (activeRef.current) {
          // Se cayó en pleno uso: cerramos limpio (CopilotPage puede reintentar).
          activeRef.current = false;
          teardown();
          setListening(false);
          setInterim('');
        }
      };
    } catch {
      activeRef.current = false;
      teardown();
      setListening(false);
      setAvailable(false);
    }
  }, [supported, lang, teardown]);

  const stop = useCallback(() => {
    activeRef.current = false;
    // Cierre elegante: avisa a Deepgram que no hay más audio.
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'CloseStream' }));
      }
    } catch { /* noop */ }
    teardown();
    setListening(false);
    setInterim('');
  }, [teardown]);

  useEffect(() => () => {
    activeRef.current = false;
    teardown();
  }, [teardown]);

  return { supported, available, listening, interim, start, stop };
}
