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
}

export function useSpeech({ lang = 'es-EC', onFinal }: UseSpeechOptions) {
  const [supported] = useState(() => getRecognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const activeRef = useRef(false);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || activeRef.current) return;
    activeRef.current = true;

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!;
        const text = r[0].transcript.trim();
        if (!text) continue;
        if (r.isFinal) onFinalRef.current(text);
        else interimText += ` ${text}`;
      }
      setInterim(interimText.trim());
    };

    // El motor corta sesiones largas / silencios: re-arrancamos mientras activo.
    rec.onend = () => {
      setInterim('');
      if (activeRef.current) {
        try {
          rec.start();
        } catch {
          setListening(false);
          activeRef.current = false;
        }
      } else {
        setListening(false);
      }
    };
    rec.onerror = (e) => {
      // 'no-speech'/'aborted' son normales en continuo; 'not-allowed' es fatal.
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
    recRef.current?.stop();
    setListening(false);
    setInterim('');
  }, []);

  useEffect(() => () => {
    activeRef.current = false;
    recRef.current?.stop();
  }, []);

  return { supported, listening, interim, start, stop };
}
