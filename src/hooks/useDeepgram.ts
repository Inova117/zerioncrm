// ============================================================================
// useDeepgram — transcripción PREMIUM en vivo con Deepgram (nova-3, español).
//
// Por qué existe: la Web Speech API del navegador es gratis pero floja con
// llamadas telefónicas en altavoz (ruido, dos voces, jerga). Deepgram nova-3
// transcribe mucho mejor ese audio (>20% menos errores que nova-2 en español
// streaming). El navegador nunca ve la master key: pide un token temporal a la
// Edge Function `deepgram-token` y abre el WS con `?access_token=JWT`.
//
// Config de MÍNIMA latencia (docs oficiales de Deepgram):
//  • AudioWorklet + PCM linear16 en buffers de ~50ms — el buffer recomendado
//    es 20-100ms; MediaRecorder con chunks de 250ms sumaba hasta 250ms de
//    acumulación y sus chunks webm no sobreviven una reconexión.
//  • SIN smart_format: en streaming puede RETENER el resultado final hasta 3s
//    esperando completar una entidad. punctuate+numerals cubren el español.
//  • endpointing=300: finales ~300ms tras la pausa, sin fragmentar frases
//    (el default de 10ms corta a mitad de oración).
//  • utterance_end_ms=1000: respaldo para altavoz — el ruido de fondo puede
//    impedir que el VAD dispare speech_final.
//  • KeepAlive cada 5s (frame de TEXTO): sin audio ni keepalive por 10s,
//    Deepgram cierra con NET-0001.
//
// Interfaz idéntica a useSpeech + `available`, para que CopilotPage cambie de
// motor sin tocar nada más. Si Deepgram no está configurado o el navegador no
// puede capturar audio → `available=false` y la página cae a Web Speech.
// ============================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/deepgram-token`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const DG_MODEL = 'nova-3'; // español monolingüe; usa 'language=multi' solo si hay spanglish real

// Procesador AudioWorklet: reenvía cada cuanto de 128 muestras al hilo
// principal. Se acumulan a ~50ms antes de enviarse al WebSocket.
const WORKLET_SRC = `
class PCMForwarder extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('pcm-forwarder', PCMForwarder);
`;
let workletUrl: string | null = null;
const getWorkletUrl = (): string => {
  if (!workletUrl) {
    workletUrl = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
  }
  return workletUrl;
};

export interface UseDeepgramOptions {
  lang?: string; // 'es-EC', 'es-MX'… (se usa solo la parte de idioma: 'es')
  onFinal: (text: string) => void;
  /** Resultado PARCIAL (inestable, casi inmediato) — solo para detección local. */
  onInterim?: (text: string) => void;
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
  if (!res.ok) {
    // Superficie del porqué (p.ej. la master key de Deepgram sin permiso para
    // /v1/auth/grant): sin esto solo se ve un 502 opaco y cuesta diagnosticar.
    const err = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
    console.warn('[deepgram-token]', res.status, err.error ?? '', err.detail ?? '');
    return { available: false };
  }
  return (await res.json()) as TokenResponse;
}

const browserCanCapture = (): boolean =>
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof AudioWorkletNode !== 'undefined' &&
  typeof WebSocket !== 'undefined';

export function useDeepgram({ lang = 'es-EC', onFinal, onInterim }: UseDeepgramOptions) {
  const [supported] = useState(browserCanCapture);
  const [available, setAvailable] = useState<boolean | null>(null); // null = probando
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');

  const activeRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;
  const onInterimRef = useRef(onInterim);
  onInterimRef.current = onInterim;

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
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
    try {
      wsRef.current?.close();
    } catch { /* noop */ }
    wsRef.current = null;
    try {
      void audioCtxRef.current?.close();
    } catch { /* noop */ }
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Generación de sesión: cada start() toma un número; stop() lo invalida.
  // Un booleano compartido no basta — stop() durante un `await` de la sesión 1
  // seguido de un start() (sesión 2) dejaba a la sesión 1 viendo "activo" de
  // nuevo: dos micrófonos + dos WebSockets vivos, finales duplicados, y la
  // limpieza de la vieja destruyendo los recursos de la nueva.
  const sessionRef = useRef(0);

  const start = useCallback(async () => {
    if (activeRef.current || !supported) return;
    activeRef.current = true;
    const session = ++sessionRef.current;
    const isCurrent = () => activeRef.current && sessionRef.current === session;

    // Recursos LOCALES de esta sesión: si queda obsoleta a mitad de arranque,
    // se limpian estos — jamás los refs (pueden ser ya de una sesión nueva).
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let ws: WebSocket | null = null;
    const cleanupLocal = () => {
      try {
        ws?.close();
      } catch { /* noop */ }
      try {
        void ctx?.close();
      } catch { /* noop */ }
      stream?.getTracks().forEach((t) => t.stop());
    };

    try {
      // 1) Micrófono PRIMERO. El prompt de permiso puede tardar minutos (el
      //    vendedor además está marcando el teléfono) — si pidiéramos el token
      //    antes, su TTL de ~60s llegaría vencido al handshake del WS.
      //
      // Audio CRUDO: el DSP del navegador está afinado para videollamadas —
      // el cancelador de eco y el supresor de ruido tratan la voz que sale del
      // PARLANTE del celular (la del cliente, chillona y lejana) como
      // interferencia y la borran antes de que llegue al WebSocket. Sin ellos,
      // Deepgram recibe las dos voces y separa mejor que Chrome. AGC se queda:
      // sube la voz lejana del parlante cuando el vendedor calla.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      if (!isCurrent()) {
        cleanupLocal();
        return;
      }
      streamRef.current = stream;

      // 2) Token fresco recién ahora, justo antes de abrir el WS.
      const tk = await fetchToken(false);
      if (!isCurrent()) {
        cleanupLocal();
        return;
      }
      if (!tk.available || !tk.access_token) {
        cleanupLocal();
        streamRef.current = null;
        activeRef.current = false;
        setAvailable(false);
        return;
      }

      // AudioContext a 16kHz (si el navegador lo ignora, usamos su rate real
      // y se lo declaramos a Deepgram en sample_rate).
      try {
        ctx = new AudioContext({ sampleRate: 16000 });
      } catch {
        ctx = new AudioContext();
      }
      audioCtxRef.current = ctx;
      await ctx.audioWorklet.addModule(getWorkletUrl());
      if (!isCurrent()) {
        cleanupLocal();
        return;
      }

      const language = lang.split('-')[0] || 'es';
      // Alias no-nulos para los closures de abajo (TS no arrastra el narrowing
      // de las variables `let` dentro de callbacks).
      const ctxOk = ctx;
      const streamOk = stream;
      const params = new URLSearchParams({
        model: DG_MODEL,
        language,
        punctuate: 'true',
        numerals: 'true',
        interim_results: 'true',
        endpointing: '300',
        utterance_end_ms: '1000',
        encoding: 'linear16',
        sample_rate: String(ctxOk.sampleRate),
        channels: '1',
        // El JWT temporal por query param es lo más robusto en el navegador
        // (evita el límite de longitud del header Sec-WebSocket-Protocol).
        access_token: tk.access_token,
      });
      const sock = new WebSocket(`wss://api.deepgram.com/v1/listen?${params.toString()}`);
      ws = sock;
      sock.binaryType = 'arraybuffer';
      wsRef.current = sock;

      sock.onopen = () => {
        if (!isCurrent()) {
          sock.close();
          return;
        }
        // Captura → PCM int16 en buffers de ~50ms.
        const source = ctxOk.createMediaStreamSource(streamOk);
        const node = new AudioWorkletNode(ctxOk, 'pcm-forwarder');
        const target = Math.max(1, Math.round(ctxOk.sampleRate * 0.05)); // ~50ms
        let acc = new Float32Array(0);
        node.port.onmessage = (e: MessageEvent<Float32Array>) => {
          if (sock.readyState !== WebSocket.OPEN) return;
          const chunk = e.data;
          const merged = new Float32Array(acc.length + chunk.length);
          merged.set(acc);
          merged.set(chunk, acc.length);
          acc = merged;
          if (acc.length < target) return;
          const pcm = new Int16Array(acc.length);
          for (let i = 0; i < acc.length; i++) {
            const s = Math.max(-1, Math.min(1, acc[i]!));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          sock.send(pcm.buffer);
          acc = new Float32Array(0);
        };
        source.connect(node); // sin conectar a destination: no queremos eco

        // Red de seguridad: sin audio ni KeepAlive por 10s Deepgram cierra.
        keepAliveRef.current = setInterval(() => {
          if (sock.readyState === WebSocket.OPEN) sock.send(JSON.stringify({ type: 'KeepAlive' }));
        }, 5000);

        setListening(true);
      };

      sock.onmessage = (ev) => {
        if (!isCurrent()) return; // mensajes tardíos de una sesión invalidada
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
            onInterimRef.current?.(text);
          }
        } catch { /* keep-alive / metadata: ignorar */ }
      };

      sock.onerror = () => {
        // El fallo se maneja en onclose (evita marcar no-disponible dos veces).
      };
      sock.onclose = () => {
        if (!isCurrent()) return;
        // Se cayó en pleno uso: cerramos limpio (CopilotPage degrada a Web
        // Speech al ver available=false) — y re-probamos en segundo plano:
        // si fue un blip transitorio, la PRÓXIMA llamada vuelve a Deepgram
        // en vez de quedarse degradada para siempre.
        activeRef.current = false;
        sessionRef.current += 1;
        teardown();
        setListening(false);
        setInterim('');
        setAvailable(false);
        setTimeout(() => {
          fetchToken(true)
            .then((r) => setAvailable(r.available))
            .catch(() => {});
        }, 3000);
      };
    } catch {
      cleanupLocal();
      if (sessionRef.current === session) {
        activeRef.current = false;
        setListening(false);
        setAvailable(false);
      }
    }
  }, [supported, lang, teardown]);

  const stop = useCallback(() => {
    activeRef.current = false;
    sessionRef.current += 1; // invalida cualquier start() aún en vuelo
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
    sessionRef.current += 1;
    teardown();
  }, [teardown]);

  return { supported, available, listening, interim, start, stop };
}
