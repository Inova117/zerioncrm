// ============================================================================
// useSpeech — transcripción en vivo con la Web Speech API (Chrome/Edge).
//
// Modo de uso real: el celular en altavoz junto a la laptop; el micrófono
// captura ambas voces y esto las transcribe en continuo. Gratis, sin backend.
// Limitaciones conocidas: solo Chrome/Edge de escritorio; el motor corta la
// sesión cada cierto tiempo → auto-restart mientras `active` sea true.
// ============================================================================
import { useCallback, useEffect, useRef, useState } from 'react';

// Tipos mínimos del API (no está en lib.dom de este tsconfig).
interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
}

const getRecognitionCtor = (): (new () => SpeechRecognitionLike) | null => {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export interface UseSpeechOptions {
  lang?: string; // 'es-EC', 'es-MX', 'es-ES', 'en-US'…
  /** Llamado con cada frase FINAL transcrita. */
  onFinal: (text: string) => void;
  /** Llamado con cada resultado PARCIAL (texto inestable, llega ~300ms tras hablar).
   *  Úsalo solo para detección instantánea local — nunca para el LLM. */
  onInterim?: (text: string) => void;
}

export function useSpeech({ lang = 'es-EC', onFinal, onInterim }: UseSpeechOptions) {
  const [supported] = useState(() => getRecognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const activeRef = useRef(false);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;
  const onInterimRef = useRef(onInterim);
  onInterimRef.current = onInterim;

  const netErrsRef = useRef(0); // errores 'network' seguidos → backoff del restart

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || activeRef.current) return;
    activeRef.current = true;
    netErrsRef.current = 0;

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    // Guardia de instancia en TODOS los handlers: rec.stop() dispara onend
    // ASÍNCRONO (~100-300ms después). Sin esto, un stop→start rápido (pausar y
    // reanudar el micrófono) deja al onend tardío de la instancia VIEJA viendo
    // activeRef=true y resucitándola — dos reconocedores vivos = todo se
    // transcribe DOBLE (líneas, contadores de objeción, coach) el resto de la
    // llamada. La instancia vigente es siempre recRef.current.
    const isCurrent = () => recRef.current === rec;

    rec.onresult = (e) => {
      if (!isCurrent()) return;
      netErrsRef.current = 0; // el motor volvió a entregar: resetea el backoff
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!;
        const text = r[0].transcript.trim();
        if (!text) continue;
        if (r.isFinal) onFinalRef.current(text);
        else interimText += ` ${text}`;
      }
      const it = interimText.trim();
      setInterim(it);
      if (it) onInterimRef.current?.(it);
    };

    // El motor corta sesiones largas / silencios: re-arrancamos mientras activo.
    // Con backoff si está fallando en caliente (p.ej. Chrome sin conexión emite
    // error→end→start→error en bucle caliente sin pausa).
    rec.onend = () => {
      if (!isCurrent()) return;
      setInterim('');
      if (!activeRef.current) {
        setListening(false);
        return;
      }
      const restart = () => {
        if (!isCurrent() || !activeRef.current) return;
        try {
          rec.start();
        } catch {
          setListening(false);
          activeRef.current = false;
        }
      };
      const delay = Math.min(netErrsRef.current * 1000, 5000);
      if (delay > 0) setTimeout(restart, delay);
      else restart();
    };
    rec.onerror = (e) => {
      if (!isCurrent()) return;
      // 'no-speech'/'aborted' son normales en continuo; 'not-allowed' es fatal.
      if (e.error === 'network') netErrsRef.current += 1;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        activeRef.current = false;
        setListening(false);
      }
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      activeRef.current = false;
    }
  }, [lang]);

  const stop = useCallback(() => {
    activeRef.current = false;
    const rec = recRef.current;
    recRef.current = null; // invalida los handlers tardíos de esta instancia
    rec?.stop();
    setListening(false);
    setInterim('');
  }, []);

  useEffect(() => () => {
    activeRef.current = false;
    const rec = recRef.current;
    recRef.current = null;
    rec?.stop();
  }, []);

  return { supported, listening, interim, start, stop };
}
