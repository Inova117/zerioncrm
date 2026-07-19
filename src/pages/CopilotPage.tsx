import { useCallback, useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles, Mic, MicOff, Phone, PhoneOff, LifeBuoy,
  Star, Globe, MapPin, Loader2, AlertTriangle, Save, ArrowRight, SlidersHorizontal,
} from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { CopilotSettingsModal } from '../components/copilot/CopilotSettingsModal';
import { hasCopilotSettings } from '../lib/copilotSettings';
import { EmptyState } from '../components/ui/misc';
import { TemperatureBadge } from '../components/ui/TemperatureBadge';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useSpeech } from '../hooks/useSpeech';
import { useDeepgram } from '../hooks/useDeepgram';
import {
  copilotBriefing, copilotSuggest, copilotSummary, copilotWarm, copilotDebrief,
  getCopilotMemory, saveCopilotMemory, saveCopilotCall, listCopilotCalls,
  type CallSummary, type CallDebrief, type CopilotCallRecord,
} from '../services/copilotService';
import { detectObjection, detectMoment, detectHora, normalizeSpeech, type Battlecard, type MomentInfo } from '../data/salesPlaybook';
import type { Lead } from '../types';
import { cn, colorFromString, initials, telLink, waLink, webLink, googleMapsUrl, fmtDate } from '../lib/utils';
import { stageLabel } from '../lib/constants';

type Phase = 'pick' | 'brief' | 'live' | 'wrap';
// Coach por EVENTO, no por goteo: objeciones, momentos urgentes y CAMBIOS de
// momento disparan a 0ms; el goteo de fondo solo cada SUGGEST_GAP_MS. Una
// jugada nueva cada 5 segundos entrenaba al vendedor a leer la pantalla en vez
// de escuchar al prospecto — el coach es el terapeuta que calla, no el que
// interrumpe. (El goteo NO se filtra por momento: momentRef guarda el ÚLTIMO
// momento detectado, no el actual — filtrar por él dejaba mudo al coach tras
// una objeción durante todo el resto de la llamada.)
const SUGGEST_GAP_MS = 20000;
// 'pitch' es urgente: "ya, dígame" / "¿de qué se trata?" es TU turno — el
// coach debe soplar el pitch al instante, no en el próximo ciclo.
// 'despedida' es urgente: si va a colgar SIN hora amarrada, el rescate tiene
// que llegar ANTES del clic, no 5 segundos después.
const URGENT_MOMENTS = ['senal-compra', 'peligro', 'gatekeeper', 'precio', 'cierre', 'pitch', 'despedida'];

// Filtro de eco: si una línea del transcript comparte una ventana de N palabras
// con la sugerencia actual, casi seguro es el VENDEDOR leyendo el consejo en
// voz alta — no debe re-disparar battlecards ni al coach.
// Se compara sin acentos NI puntuación (el habla transcrita no trae comas).
const normForEcho = (s: string): string =>
  normalizeSpeech(s)
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function sharesWindow(a: string, b: string, n = 5): boolean {
  const words = a.split(/\s+/).filter(Boolean);
  if (words.length < n || !b) return false;
  for (let i = 0; i + n <= words.length; i++) {
    if (b.includes(words.slice(i, i + n).join(' '))) return true;
  }
  return false;
}

// La apertura sembrada en el panel del coach al empezar a escuchar.
const openerSeed = (o: string): string =>
  `🎯 **Tu apertura — dila y CALLA:**\n"${o}"\n\n*Cuando el prospecto responda, te soplo la siguiente jugada.*`;

// Qué jugada toca según cuántas veces sonó la MISMA objeción (disciplina del Árbitro).
function loopPlay(n: number): string {
  if (n <= 1) return 'loop 1: battlecard tal cual';
  if (n === 2) return 'loop 2 (ÚLTIMO): riesgo cero — "no ha contratado nada, véala primero" / 50-50 si es precio';
  return 'loop 3 NO existe: retirada elegante — "la página queda prendida hasta el viernes"';
}

// Prueba A/B de aperturas (Playbook Web Local v1.1): alterna por llamada y
// queda registrada en las stats — en ~30 llamadas la data dice cuál convierte.
const AB_KEY = 'zerioncrm:aperturaAB';
function nextAperturaVariant(): 'A' | 'B' {
  try {
    const next = localStorage.getItem(AB_KEY) === 'A' ? 'B' : 'A';
    localStorage.setItem(AB_KEY, next);
    return next;
  } catch {
    return 'A';
  }
}

// Captura heurística de los números del prospecto (con numerals=true el
// transcriptor entrega dígitos). Son el ancla de toda la matemática del coach.
const RE_TICKET = /(?:me deja|deja (?:como|unos)|me queda|queda como|gano (?:como|unos)|cobro (?:como|unos)|vale (?:como|unos)|cada cliente(?: me)? deja)\D{0,8}(\d{1,4})/;
const RE_PERDIDOS = /(?:se me van|se van como|pierdo|se pierden|se me escapan|se me pierden)\D{0,8}(\d{1,3})\b/;
// La detección de "hora de lectura amarrada" vive en el playbook (detectHora,
// cubierta por el eval harness) — aquí solo se consume.

/** Condensa el historial del prospecto (comentarios/llamadas) para el coach. */
function buildHistory(
  comments: { body: string; type: string; createdAt: string }[],
  lead: Lead
): string {
  const notes = [...comments]
    .filter((c) => c.body?.trim())
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 6)
    .map((c) => `• ${fmtDate(c.createdAt)}: ${c.body.trim()}`);
  const parts: string[] = [];
  if (lead.temperature !== 'nuevo') parts.push(`Etapa actual: ${stageLabel(lead.temperature)}.`);
  if (lead.lastContactAt) parts.push(`Último contacto: ${fmtDate(lead.lastContactAt)}.`);
  if (notes.length) parts.push(`Notas previas (recientes primero):\n${notes.join('\n')}`);
  return parts.join('\n');
}

export function CopilotPage() {
  const { user } = useAuth();
  const { leads, addComment, moveLead, createTask, loadComments } = useData();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('pick');
  const [lead, setLead] = useState<Lead | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasSettings, setHasSettings] = useState(() => hasCopilotSettings());

  // Pre-call
  const [briefing, setBriefing] = useState('');
  const [briefLoading, setBriefLoading] = useState(false);

  // Live
  const [lines, setLines] = useState<string[]>([]);
  const [suggestion, setSuggestion] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  // Jugadas que el coach ya reemplazó — siguen visibles abajo (feedback real:
  // "cambiaba el mensaje y ya no podía ver lo anterior").
  const [pastSuggestions, setPastSuggestions] = useState<string[]>([]);
  const [card, setCard] = useState<Battlecard | null>(null);
  const [moment, setMoment] = useState<MomentInfo | null>(null);

  // Wrap
  const [summary, setSummary] = useState<CallSummary | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [debrief, setDebrief] = useState<CallDebrief | null>(null);
  const [debriefing, setDebriefing] = useState(false);
  // Mensaje de seguimiento por WhatsApp (editable antes de enviarlo).
  const [waText, setWaText] = useState('');
  const [pastCalls, setPastCalls] = useState<CopilotCallRecord[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [ttftMs, setTtftMs] = useState<number | null>(null); // latencia real del coach
  const [numbers, setNumbers] = useState<{ ticket: number | null; perdidos: number | null }>({
    ticket: null,
    perdidos: null,
  });

  const transcriptRef = useRef('');
  const historyRef = useRef('');
  const leadRef = useRef<Lead | null>(null);
  const momentRef = useRef<MomentInfo | null>(null);
  const cardIdRef = useRef<string | null>(null);
  const lastSuggestRef = useRef(0);
  const suggestAbortRef = useRef<AbortController | null>(null);
  const suggestingRef = useRef(false);
  const suggestionRef = useRef('');
  const linesEndRef = useRef<HTMLDivElement | null>(null);
  // Estado estructurado de la llamada (grounding del coach + stats al guardar)
  const objCountsRef = useRef<Record<string, number>>({});
  const momentsSeenRef = useRef<string[]>([]);
  const ticketRef = useRef<number | null>(null);
  const perdidosRef = useRef<number | null>(null);
  const horaRef = useRef(false); // ¿ya dio la hora de lectura? (cierre del T1)
  const callStartRef = useRef(0);
  const memoryRef = useRef(''); // memoria del nicho (lecciones acumuladas)
  const aperturaRef = useRef<'A' | 'B'>('A'); // variante A/B de esta llamada
  const openerRef = useRef(''); // la apertura del briefing (se siembra en vivo)
  const wantOpenerSeedRef = useRef(false); // escucha activada antes de extraerla

  useEffect(() => {
    suggestionRef.current = suggestion;
  }, [suggestion]);

  // Memoria de eco: las últimas jugadas REEMPLAZADAS. El vendedor suele seguir
  // leyendo la jugada anterior en voz alta justo cuando una nueva la pisa — si
  // el filtro solo mirara la actual, esa lectura pasaría como voz del prospecto
  // y dispararía battlecards/contadores falsos (bucle de retroalimentación).
  const recentEchoRef = useRef<string[]>([]);
  // Generación de llamada: invalida resúmenes/debriefs viejos que llegan tarde
  // (p.ej. "Llamar de nuevo" con el resumen de la llamada 1 aún en vuelo).
  const callGenRef = useRef(0);
  const briefAbortRef = useRef<AbortController | null>(null);

  // Antes de que una jugada nueva pise a la visible, la visible baja al
  // historial ("jugadas anteriores") en vez de desaparecer. Si era un stream
  // cortado a medias (supersede), va solo a la memoria de eco — media frase
  // no sirve como jugada, pero el vendedor pudo alcanzar a leerla.
  const archiveSuggestion = useCallback((wasPartial = false) => {
    const cur = suggestionRef.current.trim();
    if (!cur) return;
    recentEchoRef.current = [cur, ...recentEchoRef.current].slice(0, 3);
    if (!cur.startsWith('⚠️') && !wasPartial) {
      setPastSuggestions((h) => (h[0] === cur ? h : [cur, ...h].slice(0, 12)));
    }
  }, []);

  // ¿Esta frase del transcript es el vendedor leyendo una jugada (actual o
  // recién reemplazada) en voz alta?
  const isEcho = useCallback((text: string): boolean => {
    const norm = normForEcho(text);
    if (sharesWindow(norm, normForEcho(suggestionRef.current))) return true;
    return recentEchoRef.current.some((s) => sharesWindow(norm, normForEcho(s)));
  }, []);

  // La jugada instantánea de un momento — ÚNICA para onFinal y onInterim (una
  // variante añadida a un solo handler se pierde en el otro: los interims
  // llegan primero y pisan la detección del final). La variante sin-hora viene
  // del playbook (bestMoveNoHora), no de un string hardcodeado aquí.
  const instantPlay = useCallback(
    (m: MomentInfo): string =>
      m.bestMoveNoHora && !horaRef.current
        ? `⚡ **${m.label}** — ${m.bestMoveNoHora}`
        : `⚡ **${m.label}** — ${m.bestMove}`,
    []
  );

  // Stats legibles de la llamada (para el debrief, el comentario y el registro).
  const buildStatsLine = useCallback((): string => {
    const mins = callStartRef.current
      ? Math.max(1, Math.round((Date.now() - callStartRef.current) / 60000))
      : 0;
    const objs = Object.entries(objCountsRef.current)
      .map(([id, n]) => (n > 1 ? `${id}×${n}` : id))
      .join(', ');
    return [
      `Apertura ${aperturaRef.current}`,
      mins ? `${mins} min` : '',
      momentsSeenRef.current.length ? `Ruta: ${momentsSeenRef.current.join(' → ')}` : '',
      objs ? `Objeciones: ${objs}` : '',
      ticketRef.current != null ? `Ticket ≈ $${ticketRef.current}` : '',
      perdidosRef.current != null ? `Pierde ≈ ${perdidosRef.current}/mes` : '',
      `Hora amarrada: ${horaRef.current ? 'sí' : 'no'}`,
    ]
      .filter(Boolean)
      .join(' · ');
  }, []);

  // Resumen del estado que viaja al coach en cada suggest: le da el número de
  // loop por objeción (disciplina L1→L2→L3) y los números del prospecto.
  const buildCallState = useCallback((): string => {
    const parts: string[] = [];
    const objs = Object.entries(objCountsRef.current);
    if (objs.length) {
      parts.push(
        'Objeciones sonadas: ' +
          objs.map(([id, n]) => `${id}×${n} (→${loopPlay(n)})`).join(' · ')
      );
    }
    const nums: string[] = [];
    if (ticketRef.current != null) nums.push(`ticket ≈ $${ticketRef.current}`);
    if (perdidosRef.current != null) nums.push(`pierde ≈ ${perdidosRef.current} clientes/mes`);
    if (nums.length) parts.push(`Números del prospecto (úsalos EXACTOS): ${nums.join(' · ')}`);
    // La hora solo es contexto útil cuando está amarrada (que el coach no la
    // re-pida) o cuando el cierre/despedida está en juego SIN ella. Meterla en
    // todo suggest contaminaba las llamadas T2 con "el T1 no termina sin ella".
    if (horaRef.current) {
      parts.push('Hora de lectura: AMARRADA — no la vuelvas a pedir');
    } else if (['senal-compra', 'cierre', 'despedida'].includes(momentRef.current?.id ?? '')) {
      parts.push('Hora de lectura: aún NO amarrada (si es el toque 1, no cuelgues sin ella; si es el toque 2, cierra el pago)');
    }
    return parts.join('. ');
  }, []);

  // Lanzamiento con ?lead=<id> desde el detalle del prospecto.
  useEffect(() => {
    const id = params.get('lead');
    if (id && phase === 'pick') {
      const found = leads.find((l) => l.id === id);
      if (found) startBriefing(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, leads]);

  // --- Coach (streaming, con supersede) ---------------------------------------
  // Cada suggest nuevo ABORTA al anterior en vuelo: siempre gana el consejo más
  // fresco. Y no blanqueamos el panel: la jugada anterior (o la instantánea)
  // queda visible hasta que llega el primer token del refinamiento.
  const runSuggest = useCallback(
    async (l: Lead, trigger?: string) => {
      // Si pisamos un stream aún en vuelo, lo visible es una jugada PARCIAL.
      const prevPartial = suggestingRef.current;
      suggestAbortRef.current?.abort();
      const ctrl = new AbortController();
      suggestAbortRef.current = ctrl;
      lastSuggestRef.current = Date.now();
      wantOpenerSeedRef.current = false; // el coach ya tomó el panel
      suggestingRef.current = true;
      setSuggesting(true);
      const t0 = Date.now();
      let acc = '';
      try {
        await copilotSuggest(
          {
            lead: l,
            transcript: transcriptRef.current,
            trigger,
            history: historyRef.current,
            moment: momentRef.current ? `${momentRef.current.label}: ${momentRef.current.bestMove}` : undefined,
            callState: buildCallState() || undefined,
            memory: memoryRef.current || undefined,
          },
          (chunk) => {
            if (ctrl.signal.aborted) return;
            if (!acc) {
              setTtftMs(Date.now() - t0); // primer token: latencia real
              archiveSuggestion(prevPartial); // la anterior baja al historial, no se pierde
            }
            acc += chunk;
            setSuggestion(acc);
          },
          ctrl.signal
        );
      } catch (e) {
        if (!ctrl.signal.aborted) {
          archiveSuggestion(prevPartial);
          setSuggestion(`⚠️ ${e instanceof Error ? e.message : 'Coach no disponible'}`);
        }
      } finally {
        if (suggestAbortRef.current === ctrl) {
          suggestingRef.current = false;
          setSuggesting(false);
        }
      }
    },
    [archiveSuggestion]
  );

  // Cada frase final: transcript + momento + objeción instantánea + coach.
  const onFinal = useCallback(
    (text: string) => {
      transcriptRef.current = `${transcriptRef.current} ${text}`.trim().slice(-6000);
      setLines((prev) => [...prev, text]);

      // 0) Filtro de eco: si es el vendedor leyendo un consejo (actual o recién
      //    reemplazado) en voz alta, entra al transcript pero NO re-dispara nada.
      const norm = normalizeSpeech(text);
      if (isEcho(text)) return;

      // 0b) Números del prospecto (ticket / clientes perdidos): el ancla de
      //     toda la matemática. Solo sobre finales (texto estable).
      const mt = RE_TICKET.exec(norm);
      if (mt) ticketRef.current = Number(mt[1]);
      const mp = RE_PERDIDOS.exec(norm);
      if (mp) perdidosRef.current = Number(mp[1]);
      if (mt || mp) setNumbers({ ticket: ticketRef.current, perdidos: perdidosRef.current });

      // 0c) ¿Dio la hora de lectura? (el cierre real del T1 — alimenta el
      //     callState y el rescate de la despedida sin hora)
      if (detectHora(text)) horaRef.current = true;

      // 1) ¿En qué momento de la llamada estamos? (regex, instantáneo)
      const prevMomentId = momentRef.current?.id;
      const m = detectMoment(text);
      if (m) {
        momentRef.current = m;
        setMoment(m);
        if (momentsSeenRef.current[momentsSeenRef.current.length - 1] !== m.label) {
          momentsSeenRef.current.push(m.label);
        }
      }

      // 2) Battlecard de objeción (respuesta lista sin esperar al LLM) + el
      //    contador de loops POR objeción que alimenta la disciplina del Árbitro
      const hit = detectObjection(text);
      if (hit) {
        cardIdRef.current = hit.id;
        setCard(hit);
        objCountsRef.current[hit.id] = (objCountsRef.current[hit.id] ?? 0) + 1;
      }

      // 3) Jugada instantánea: si entramos a un momento urgente NUEVO, la mejor
      //    jugada de ese momento aparece YA (0ms); el LLM la refina encima.
      const urgent = m && URGENT_MOMENTS.includes(m.id);
      if (urgent && m.id !== prevMomentId && !suggestingRef.current) {
        archiveSuggestion();
        setSuggestion(instantPlay(m));
      }

      // 4) Coach LLM por EVENTO: objeción, momento urgente o CAMBIO de momento
      //    → YA (supersede al anterior; el cambio de momento cubre p.ej. una
      //    objeción fraseada fuera de toda battlecard). El goteo de fondo solo
      //    con colchón de 20s.
      if (lead && (hit || urgent || (m && m.id !== prevMomentId))) {
        runSuggest(lead, text);
      } else if (lead && Date.now() - lastSuggestRef.current > SUGGEST_GAP_MS) {
        runSuggest(lead);
      }
    },
    [lead, runSuggest, archiveSuggestion, isEcho, instantPlay]
  );

  // Cada resultado PARCIAL (~300ms tras hablar): detección instantánea local.
  // El texto es inestable → no entra al transcript; pero la battlecard, el
  // chip de momento y la jugada instantánea saltan de una. Y en momentos
  // URGENTES disparamos el LLM ESPECULATIVAMENTE sobre el parcial (no
  // esperamos el cierre de frase): si el final difiere, el supersede lo
  // corrige; si coincide, ganamos ~0.5-1.5s.
  const onInterim = useCallback(
    (text: string) => {
      // Filtro de eco: el vendedor leyendo un consejo (actual o reciente) no dispara nada.
      if (isEcho(text)) return;
      const hit = detectObjection(text);
      if (hit && hit.id !== cardIdRef.current) {
        cardIdRef.current = hit.id;
        setCard(hit);
      }
      const m = detectMoment(text);
      if (m && m.id !== momentRef.current?.id) {
        momentRef.current = m;
        setMoment(m);
        if (momentsSeenRef.current[momentsSeenRef.current.length - 1] !== m.label) {
          momentsSeenRef.current.push(m.label);
        }
        if (!suggestingRef.current) {
          archiveSuggestion();
          setSuggestion(instantPlay(m));
        }
        if (URGENT_MOMENTS.includes(m.id) && leadRef.current) {
          runSuggest(leadRef.current, text); // especulativo: una vez por cambio de momento
        }
      }
    },
    [runSuggest, archiveSuggestion, isEcho, instantPlay]
  );

  // Dos motores de transcripción; misma interfaz. Deepgram (premium) si está
  // configurado y disponible; si no, Web Speech del navegador (gratis).
  const dg = useDeepgram({ lang: 'es-EC', onFinal, onInterim });
  const ws = useSpeech({ lang: 'es-EC', onFinal, onInterim });
  const [engineName, setEngineName] = useState<'deepgram' | 'web'>('web');
  const engine = engineName === 'deepgram' ? dg : ws;

  // Elegimos motor cuando resuelve el probe de Deepgram (fuera de la llamada).
  useEffect(() => {
    if (phase === 'pick' || phase === 'brief') {
      setEngineName(dg.available === true && dg.supported ? 'deepgram' : 'web');
    }
  }, [dg.available, dg.supported, phase]);

  // Degradación en caliente: si Deepgram cae durante la llamada, seguimos con
  // Web Speech sin cortar la sesión.
  const degradedRef = useRef(false);
  useEffect(() => {
    if (phase === 'live' && engineName === 'deepgram' && dg.available === false && !degradedRef.current) {
      degradedRef.current = true;
      setEngineName('web');
      ws.start();
    }
  }, [phase, engineName, dg.available, ws.start]);

  useEffect(() => {
    linesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines, engine.interim]);

  // --- Flujo -----------------------------------------------------------------
  async function startBriefing(l: Lead) {
    // Nueva llamada = nueva generación: cualquier stream/promesa de la llamada
    // anterior (briefing a medias, resumen lento) queda invalidado y abortado.
    callGenRef.current += 1;
    briefAbortRef.current?.abort();
    const briefCtrl = new AbortController();
    briefAbortRef.current = briefCtrl;
    aperturaRef.current = nextAperturaVariant();
    setLead(l);
    leadRef.current = l;
    setPhase('brief');
    setBriefing('');
    setBriefLoading(true);
    setError(null);
    // Precalienta el cache del modelo de suggest (fire-and-forget): la primera
    // sugerencia en vivo pasa de ~3-5s a ~1.2s.
    copilotWarm();
    // Llamadas anteriores de este prospecto (revisables) — no bloquea el briefing.
    setPastCalls([]);
    listCopilotCalls(l.id).then(setPastCalls).catch(() => {});
    // El coach conoce al prospecto (historial) Y el nicho (memoria acumulada).
    const [comments, memory] = await Promise.all([
      loadComments(l.id).catch(() => []),
      getCopilotMemory().catch(() => ''),
    ]);
    historyRef.current = buildHistory(comments, l);
    memoryRef.current = memory;
    try {
      // La apertura (primera frase larga entre comillas) se extrae DURANTE el
      // stream — así queda lista aunque actives la escucha antes de que el
      // briefing termine — y se siembra en el panel del coach al escuchar.
      openerRef.current = '';
      let acc = '';
      await copilotBriefing(
        l,
        historyRef.current,
        memoryRef.current,
        aperturaRef.current,
        (chunk) => {
          if (briefCtrl.signal.aborted) return; // stream zombi: no interlinea
          acc += chunk;
          setBriefing((s) => s + chunk);
          if (!openerRef.current) {
            const m = /"([^"\n]{40,400})"/.exec(acc);
            if (m) {
              openerRef.current = m[1]!;
              // Si la escucha ya está activa (usuario rápido), siembra ahora.
              if (wantOpenerSeedRef.current) {
                wantOpenerSeedRef.current = false;
                setSuggestion(openerSeed(openerRef.current));
              }
            }
          }
        },
        briefCtrl.signal
      );
    } catch (e) {
      if (!briefCtrl.signal.aborted) {
        setError(e instanceof Error ? e.message : 'No se pudo generar el briefing.');
      }
    } finally {
      if (briefAbortRef.current === briefCtrl) setBriefLoading(false);
    }
  }

  function startListening() {
    if (!engine.supported) {
      setError('Tu navegador no soporta captura de micrófono. Usa Chrome o Edge de escritorio.');
      return;
    }
    degradedRef.current = false;
    recentEchoRef.current = [];
    setPhase('live');
    setLines([]);
    setSuggestion('');
    setPastSuggestions([]);
    setCard(null);
    setMoment(null);
    setTtftMs(null);
    setNumbers({ ticket: null, perdidos: null });
    momentRef.current = null;
    cardIdRef.current = null;
    transcriptRef.current = '';
    objCountsRef.current = {};
    momentsSeenRef.current = [];
    ticketRef.current = null;
    perdidosRef.current = null;
    horaRef.current = false;
    callStartRef.current = Date.now();
    // lastSuggest en 0: la PRIMERA respuesta del prospecto siempre dispara al
    // coach de una (tu lectura de la apertura no cuenta — la filtra el eco).
    lastSuggestRef.current = 0;
    // La primera jugada YA está en pantalla: tu apertura. La dices, callas,
    // y cuando el prospecto responda el coach sopla la siguiente. Si el stream
    // del briefing aún no llegó a la frase, se siembra apenas aparezca.
    if (openerRef.current) {
      setSuggestion(openerSeed(openerRef.current));
    } else {
      wantOpenerSeedRef.current = true;
    }
    copilotWarm(); // re-toque al cache por si el briefing tomó >5 min
    engine.start();
  }

  async function hangUp() {
    dg.stop();
    ws.stop();
    suggestAbortRef.current?.abort();
    wantOpenerSeedRef.current = false; // un opener tardío no debe pintar en wrap
    setPhase('wrap');
    if (!lead) return;
    // Guarda de generación: si el usuario hace "Llamar de nuevo" mientras este
    // resumen/debrief sigue en vuelo, sus resultados llegan tarde y se DESCARTAN
    // (sin esto, el wrap de la llamada 2 mostraba datos de la llamada 1).
    const gen = callGenRef.current;
    setSummarizing(true);
    setSaved(false);
    setDebrief(null);
    setWaText('');
    // Resumen y coaching corren EN PARALELO: el resumen alimenta el CRM,
    // el debrief te dice qué mejorar y actualiza la memoria del nicho.
    setDebriefing(true);
    copilotDebrief({
      lead,
      transcript: transcriptRef.current,
      stats: buildStatsLine(),
      memory: memoryRef.current,
    })
      .then((d) => {
        if (gen !== callGenRef.current) return;
        setDebrief(d);
        setWaText(d?.whatsapp ?? '');
      })
      .catch(() => gen === callGenRef.current && setDebrief(null))
      .finally(() => gen === callGenRef.current && setDebriefing(false));
    try {
      const s = await copilotSummary(lead, transcriptRef.current);
      if (gen === callGenRef.current) setSummary(s);
    } catch (e) {
      if (gen === callGenRef.current) {
        setError(e instanceof Error ? e.message : 'No se pudo generar el resumen.');
      }
    } finally {
      if (gen === callGenRef.current) setSummarizing(false);
    }
  }

  async function saveToLead() {
    // savingRef, no estado: dos clicks en el mismo tick pasarían un guard de
    // useState (el re-render llega después) y duplicarían comentario + tarea.
    if (!lead || !summary || saved || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const statsLine = buildStatsLine();
    const body = `📞 Llamada (Copilot) — ${summary.summary}${summary.nextAction ? `\n➡️ Próxima acción: ${summary.nextAction}` : ''}${statsLine ? `\n📊 ${statsLine}` : ''}`;
    try {
      // La llamada completa (transcript + coaching) queda revisable, y la
      // memoria del nicho actualizada alimenta TODAS las llamadas siguientes.
      saveCopilotCall({
        leadId: lead.id,
        transcript: transcriptRef.current,
        summary: summary.summary,
        temperature: summary.temperature,
        nextAction: summary.nextAction,
        stats: statsLine,
        coaching: debrief?.coaching ?? '',
      }).catch(() => {});
      if (debrief?.lessons && debrief.lessons !== memoryRef.current) {
        memoryRef.current = debrief.lessons;
        saveCopilotMemory(debrief.lessons).catch(() => {});
      }
      await addComment(lead.id, body);
      if (summary.temperature !== lead.temperature) {
        await moveLead(lead.id, summary.temperature);
      }
      if (summary.nextAction) {
        await createTask({
          title: `Seguimiento: ${lead.company}`,
          notes: summary.nextAction,
          cadence: 'daily',
          assignedTo: lead.assignedTo || user!.id,
          leadId: lead.id,
          dueDate: null,
          recurring: false,
          target: 0,
        });
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar en el prospecto — reintenta.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  // Volver a llamar al MISMO prospecto sin dar la vuelta por Prospectos:
  // limpia la llamada anterior y regenera el briefing (que ya incluye la
  // llamada recién guardada en el historial y en 📼 llamadas anteriores).
  function callAgain() {
    if (!lead) return;
    const l = lead;
    dg.stop();
    ws.stop();
    suggestAbortRef.current?.abort();
    degradedRef.current = false;
    recentEchoRef.current = [];
    setLines([]);
    setSuggestion('');
    setPastSuggestions([]);
    setCard(null);
    setMoment(null);
    setSummary(null);
    setDebrief(null);
    setWaText('');
    setSaved(false);
    setError(null);
    setTtftMs(null);
    setNumbers({ ticket: null, perdidos: null });
    transcriptRef.current = '';
    momentRef.current = null;
    cardIdRef.current = null;
    objCountsRef.current = {};
    momentsSeenRef.current = [];
    ticketRef.current = null;
    perdidosRef.current = null;
    horaRef.current = false;
    callStartRef.current = 0;
    startBriefing(l);
  }

  function reset() {
    dg.stop();
    ws.stop();
    suggestAbortRef.current?.abort();
    briefAbortRef.current?.abort();
    callGenRef.current += 1; // invalida resúmenes/debriefs en vuelo
    wantOpenerSeedRef.current = false;
    degradedRef.current = false;
    recentEchoRef.current = [];
    setPhase('pick');
    setLead(null);
    leadRef.current = null;
    setBriefing('');
    setLines([]);
    setSuggestion('');
    setPastSuggestions([]);
    setCard(null);
    setMoment(null);
    setDebrief(null);
    setWaText('');
    setPastCalls([]);
    momentRef.current = null;
    cardIdRef.current = null;
    setSummary(null);
    setSaved(false);
    setError(null);
    transcriptRef.current = '';
    historyRef.current = '';
    openerRef.current = '';
    if (params.get('lead')) setParams({}, { replace: true });
    // El copilot vive DENTRO del flujo de prospectos: al terminar, de vuelta.
    navigate('/leads');
  }

  if (!user) return null;

  return (
    <AppLayout
      title="Sales Copilot"
      subtitle="Pon el celular en altavoz, dale a escuchar y el AI te sopla qué decir en tiempo real."
      fullBleed
      actions={
        <button
          className={cn('btn-secondary', !hasSettings && 'ring-1 ring-brand-300')}
          onClick={() => setSettingsOpen(true)}
          title="Enséñale al coach tu oferta, precios y tono"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">{hasSettings ? 'Ajustes' : 'Configura tu oferta'}</span>
        </button>
      }
    >
      <div className="flex h-full flex-col px-4 py-4 sm:px-6">
        {error && (
          <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </p>
        )}

        {/* Sin prospecto: el copilot se abre DESDE el popup del prospecto */}
        {phase === 'pick' && (
          <div className="mx-auto flex w-full max-w-md flex-1 items-center">
            <EmptyState
              icon={<Sparkles className="h-10 w-10" />}
              title="El copilot se abre desde un prospecto"
              description='Ve a Prospectos, abre el negocio que vas a contactar y pulsa "Sales Copilot". Ahí llamas o escribes por WhatsApp y activas la escucha cuando arranque la conversación.'
              action={
                <RouterLink to="/leads" className="btn-primary">
                  Ir a Prospectos <ArrowRight className="h-4 w-4" />
                </RouterLink>
              }
            />
          </div>
        )}

        {/* --------------------------------------------- BRIEF / LIVE / WRAP */}
        {phase !== 'pick' && lead && (
          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_1.1fr]">
            {/* Columna izquierda: ficha + transcripción */}
            <div className="flex min-h-0 flex-col gap-3">
              <LeadHeader lead={lead} onBack={reset} />

              {phase === 'live' && (
                <div className="card flex min-h-0 flex-1 flex-col p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-surface-400">
                    <Mic className={cn('h-3.5 w-3.5', engine.listening ? 'text-red-500' : 'text-surface-400')} />
                    Transcripción
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal',
                        engineName === 'deepgram'
                          ? 'bg-brand-100 text-brand-700'
                          : 'bg-surface-100 text-surface-500'
                      )}
                      title={engineName === 'deepgram'
                        ? 'Deepgram nova-2: transcripción premium, mejor con audio de llamada'
                        : 'Web Speech del navegador (gratis). Configura DEEPGRAM_API_KEY para la versión premium.'}
                    >
                      {engineName === 'deepgram' ? 'Deepgram · premium' : 'Navegador'}
                    </span>
                    {engine.listening && <span className="ml-auto flex items-center gap-1 text-red-500">● en vivo</span>}
                  </div>
                  <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1 text-sm text-surface-700">
                    {lines.length === 0 && !engine.interim && (
                      <p className="text-surface-400">Escuchando… habla o pon el celular en altavoz.</p>
                    )}
                    {lines.map((l, i) => (
                      <p key={i}>{l}</p>
                    ))}
                    {engine.interim && <p className="text-surface-400">{engine.interim}</p>}
                    <div ref={linesEndRef} />
                  </div>
                </div>
              )}
            </div>

            {/* Columna derecha: briefing (brief) / coach (live) / resumen (wrap) */}
            <div className="flex min-h-0 flex-col gap-3">
              {phase === 'brief' && (
                <>
                  <div className="card flex min-h-0 flex-1 flex-col p-4">
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-500">
                      <Sparkles className="h-3.5 w-3.5" /> Tu apertura
                    </p>
                    <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap pr-1 text-sm leading-relaxed text-surface-700">
                      {briefing || (briefLoading ? '' : 'Preparando…')}
                      {briefLoading && <Loader2 className="ml-1 inline h-4 w-4 animate-spin text-brand-400" />}
                    </div>
                  </div>
                  {pastCalls.length > 0 && (
                    <div className="card max-h-56 overflow-y-auto p-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-surface-400">
                        📼 Llamadas anteriores con este prospecto ({pastCalls.length})
                      </p>
                      <div className="space-y-2">
                        {pastCalls.map((c) => (
                          <details key={c.id} className="rounded-lg border border-surface-200 p-2.5">
                            <summary className="cursor-pointer text-xs text-surface-600">
                              <span className="font-semibold">{fmtDate(c.createdAt)}</span>
                              {c.stats && <span className="text-surface-400"> · {c.stats.split(' · ')[0]}</span>}
                              {' — '}
                              {c.summary.slice(0, 80)}
                              {c.summary.length > 80 ? '…' : ''}
                            </summary>
                            <div className="mt-2 space-y-2 text-xs text-surface-600">
                              {c.coaching && (
                                <p className="whitespace-pre-wrap rounded bg-brand-50/50 p-2">🎓 {c.coaching}</p>
                              )}
                              {c.stats && <p className="text-surface-400">📊 {c.stats}</p>}
                              {c.transcript && (
                                <details>
                                  <summary className="cursor-pointer text-surface-400">Ver transcripción</summary>
                                  <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap">{c.transcript}</p>
                                </details>
                              )}
                            </div>
                          </details>
                        ))}
                      </div>
                    </div>
                  )}
                  <button className="btn-primary w-full py-3 text-base" onClick={startListening}>
                    <Mic className="h-5 w-5" /> Empezar a escuchar la llamada
                  </button>
                  <p className="text-center text-xs text-surface-400">
                    Llama o escribe por WhatsApp desde la ficha de arriba — y activa la escucha cuando
                    arranque la conversación (celular en altavoz).
                  </p>
                </>
              )}

              {phase === 'live' && (
                <>
                  {(moment || numbers.ticket != null || numbers.perdidos != null) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {moment && (
                        <div
                          className={cn(
                            'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold',
                            moment.id === 'senal-compra' && 'border-green-300 bg-green-50 text-green-800',
                            moment.id === 'peligro' && 'border-red-300 bg-red-50 text-red-800',
                            (moment.id === 'precio' || moment.id === 'objecion') && 'border-amber-300 bg-amber-50 text-amber-800',
                            !['senal-compra', 'peligro', 'precio', 'objecion'].includes(moment.id) &&
                              'border-surface-200 bg-surface-50 text-surface-700'
                          )}
                        >
                          <span className="text-base leading-none">{moment.emoji}</span>
                          <span>Momento: {moment.label}</span>
                        </div>
                      )}
                      {numbers.ticket != null && (
                        <span
                          className="rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-sm font-semibold text-emerald-800"
                          title="Lo que le deja un cliente — el ancla de toda la matemática"
                        >
                          💵 Ticket ≈ ${numbers.ticket}
                        </span>
                      )}
                      {numbers.perdidos != null && (
                        <span
                          className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-sm font-semibold text-rose-800"
                          title="Clientes que dice perder al mes"
                        >
                          📉 Pierde ≈ {numbers.perdidos}/mes
                        </span>
                      )}
                    </div>
                  )}
                  {card && (
                    <div className="card border-l-4 border-l-amber-400 bg-amber-50/50 p-3">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                        ⚡ Objeción: {card.objection}
                      </p>
                      <p className="text-sm font-medium text-surface-800">{card.response}</p>
                    </div>
                  )}
                  <div className="card flex min-h-0 flex-1 flex-col p-4">
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-500">
                      <Sparkles className="h-3.5 w-3.5" /> Coach en vivo
                      {suggesting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {ttftMs != null && (
                        <span
                          className="ml-auto rounded-full bg-surface-100 px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal text-surface-400"
                          title="Tiempo hasta el primer token de la última sugerencia"
                        >
                          {(ttftMs / 1000).toFixed(1)}s
                        </span>
                      )}
                    </p>
                    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-surface-800">
                        {suggestion || (
                          <span className="text-surface-400">El coach te irá soplando la mejor jugada. Toca “Ayuda” cuando lo necesites.</span>
                        )}
                      </div>
                      {pastSuggestions.length > 0 && (
                        <div className="mt-3 border-t border-surface-100 pt-2">
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-surface-300">
                            Jugadas anteriores
                          </p>
                          <div className="space-y-2">
                            {/* En vivo solo las 3 últimas: más historial = más ojos en pantalla
                                y menos en la voz del prospecto. (El resto queda en estado por si
                                el wrap las quiere mostrar algún día — hoy no las renderiza.) */}
                            {pastSuggestions.slice(0, 3).map((s, i) => (
                              <p key={i} className="whitespace-pre-wrap text-xs leading-relaxed text-surface-400">
                                {s}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn-secondary flex-1 py-3"
                      onClick={() => lead && runSuggest(lead)}
                      disabled={suggesting}
                    >
                      <LifeBuoy className="h-5 w-5" /> Ayuda
                    </button>
                    <button className="btn-danger flex-1 py-3" onClick={hangUp}>
                      <PhoneOff className="h-5 w-5" /> Terminar
                    </button>
                  </div>
                  <button
                    className="text-center text-xs text-surface-400 hover:text-surface-600"
                    onClick={() => (engine.listening ? engine.stop() : engine.start())}
                  >
                    {engine.listening ? (
                      <span className="inline-flex items-center gap-1"><MicOff className="h-3 w-3" /> pausar micrófono</span>
                    ) : (
                      <span className="inline-flex items-center gap-1"><Mic className="h-3 w-3" /> reanudar micrófono</span>
                    )}
                  </button>
                </>
              )}

              {phase === 'wrap' && (
                <div className="card flex min-h-0 flex-1 flex-col p-4">
                  <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-500">
                    <Sparkles className="h-3.5 w-3.5" /> Resumen de la llamada
                  </p>
                  {summarizing ? (
                    <div className="flex flex-1 items-center justify-center text-surface-400">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : summary ? (
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                      <p className="text-sm leading-relaxed text-surface-700">{summary.summary}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-surface-400">Temperatura sugerida:</span>
                        <TemperatureBadge temperature={summary.temperature} />
                      </div>
                      {summary.nextAction && (
                        <div className="rounded-lg border border-surface-200 p-3">
                          <p className="text-[11px] uppercase tracking-wide text-surface-400">Próxima acción</p>
                          <p className="text-sm text-surface-700">{summary.nextAction}</p>
                        </div>
                      )}

                      {/* Coaching post-llamada: el sales manager revisando la grabación */}
                      <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-3">
                        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-600">
                          🎓 Coaching de esta llamada
                          {debriefing && <Loader2 className="h-3 w-3 animate-spin" />}
                        </p>
                        {debrief ? (
                          <>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-surface-700">{debrief.coaching}</p>
                            {debrief.lessons && debrief.lessons !== memoryRef.current && (
                              <p className="mt-2 text-[11px] text-brand-600">
                                🧠 La memoria del nicho se actualizará al guardar — la próxima llamada arranca sabiendo esto.
                              </p>
                            )}
                          </>
                        ) : debriefing ? (
                          <p className="text-sm text-surface-400">Revisando la grabación…</p>
                        ) : (
                          <p className="text-sm text-surface-400">Sin coaching para esta llamada.</p>
                        )}
                      </div>

                      {/* Seguimiento por WhatsApp: rescate takeaway (si colgó sin
                          escuchar la oferta) o confirmación de cita. El coach lo
                          redacta; tú lo editas y lo mandas con un toque. */}
                      {debrief?.whatsapp && lead && (lead.phone || lead.enrichment?.whatsapp) ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                            💬 WhatsApp de seguimiento
                          </p>
                          <textarea
                            className="input min-h-24 w-full resize-y text-sm"
                            value={waText}
                            onChange={(e) => setWaText(e.target.value)}
                          />
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <a
                              href={waLink(lead.phone || lead.enrichment?.whatsapp || '', waText)}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-primary px-3 py-1.5 text-xs"
                            >
                              Enviar por WhatsApp
                            </a>
                            <p className="text-[11px] text-surface-400">
                              Edítalo si quieres — se abre en WhatsApp listo para enviar.
                            </p>
                          </div>
                        </div>
                      ) : debrief && debrief.whatsapp === '' ? (
                        <p className="text-[11px] text-surface-400">
                          💤 El coach recomienda no escribirle por WhatsApp — dejar enfriar y reintentar en 2-3 meses.
                        </p>
                      ) : null}

                      {/* La conversación completa, revisable */}
                      {lines.length > 0 && (
                        <details className="rounded-lg border border-surface-200 p-3">
                          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-surface-400">
                            📼 Ver la conversación completa ({lines.length} frases)
                          </summary>
                          <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto text-sm text-surface-600">
                            {lines.map((l, i) => (
                              <p key={i}>{l}</p>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ) : null}

                  <div className="mt-3 space-y-2">
                    {saved ? (
                      <span className="btn-secondary flex w-full justify-center py-3 text-emerald-600">
                        <Save className="h-4 w-4" /> Guardado en el prospecto
                      </span>
                    ) : (
                      <button className="btn-primary w-full py-3" onClick={saveToLead} disabled={!summary || saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar en el prospecto
                      </button>
                    )}
                    <div className="flex gap-2">
                      <button
                        className="btn-secondary flex-1 py-3"
                        onClick={callAgain}
                        title="Nuevo briefing con el historial ya actualizado — sin dar la vuelta por Prospectos"
                      >
                        <Phone className="h-4 w-4" /> Llamar de nuevo
                      </button>
                      <button className="btn-secondary flex-1 py-3" onClick={reset}>
                        Volver a Prospectos <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <CopilotSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => setHasSettings(hasCopilotSettings())}
      />
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------
function LeadHeader({ lead, onBack }: { lead: Lead; onBack: () => void }) {
  const e = lead.enrichment;
  const phone = lead.phone || e?.whatsapp || '';
  const gmaps = googleMapsUrl(e);
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: colorFromString(lead.company) }}
        >
          {initials(lead.company) || '?'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-surface-900">{lead.company}</p>
          <p className="truncate text-xs text-surface-500">
            {lead.industry || 'Sin categoría'} · {stageLabel(lead.temperature)}
          </p>
        </div>
        <button className="btn-ghost rounded-lg px-2 py-1 text-xs text-surface-400" onClick={onBack}>
          cambiar
        </button>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {!lead.website.trim() && <span className="badge bg-brand-100 font-semibold text-brand-700">Sin sitio web</span>}
        {e?.rating != null && (
          <span className="badge bg-surface-100 text-surface-600">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {e.rating}{e.reviewCount != null && ` · ${e.reviewCount}`}
          </span>
        )}
        {e?.city && (
          <span className="badge bg-surface-100 text-surface-600">
            <MapPin className="h-3 w-3" /> {e.city}
          </span>
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {phone && (
          <>
            <a href={telLink(phone)} className="btn-secondary px-2.5 py-1.5 text-xs">
              <Phone className="h-3.5 w-3.5" /> {phone}
            </a>
            <a href={waLink(phone)} target="_blank" rel="noreferrer" className="btn-secondary px-2.5 py-1.5 text-xs">
              WhatsApp
            </a>
          </>
        )}
        {lead.website && (
          <a href={webLink(lead.website)} target="_blank" rel="noreferrer" className="btn-secondary px-2.5 py-1.5 text-xs">
            <Globe className="h-3.5 w-3.5" /> Sitio
          </a>
        )}
        {gmaps && (
          <a href={gmaps} target="_blank" rel="noreferrer" className="btn-secondary px-2.5 py-1.5 text-xs">
            <MapPin className="h-3.5 w-3.5" /> Maps
          </a>
        )}
      </div>
    </div>
  );
}
