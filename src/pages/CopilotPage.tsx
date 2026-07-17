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
import { detectObjection, detectMoment, normalizeSpeech, type Battlecard, type MomentInfo } from '../data/salesPlaybook';
import type { Lead } from '../types';
import { cn, colorFromString, initials, telLink, waLink, webLink, googleMapsUrl, fmtDate } from '../lib/utils';
import { stageLabel } from '../lib/constants';

type Phase = 'pick' | 'brief' | 'live' | 'wrap';
// Coach reactivo: responde tras CADA frase final del prospecto, con un colchón
// mínimo para no ametrallar el API cuando la conversación fluye normal.
// Los momentos urgentes y las objeciones se saltan el colchón.
const SUGGEST_GAP_MS = 5000;
const URGENT_MOMENTS = ['senal-compra', 'peligro', 'gatekeeper', 'precio', 'cierre'];

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

// Qué jugada toca según cuántas veces sonó la MISMA objeción (disciplina del Árbitro).
function loopPlay(n: number): string {
  if (n <= 1) return 'loop 1: battlecard tal cual';
  if (n === 2) return 'loop 2: riesgo cero + prueba en vivo';
  if (n === 3) return 'loop 3: dolor futuro con sus números';
  return 'loop 4 NO existe: retirada elegante con fecha y hora';
}

// Captura heurística de los números del prospecto (con numerals=true el
// transcriptor entrega dígitos). Son el ancla de toda la matemática del coach.
const RE_TICKET = /(?:me deja|deja (?:como|unos)|me queda|queda como|gano (?:como|unos)|cobro (?:como|unos)|vale (?:como|unos)|cada cliente(?: me)? deja)\D{0,8}(\d{1,4})/;
const RE_PERDIDOS = /(?:se me van|se van como|pierdo|se pierden|se me escapan|se me pierden)\D{0,8}(\d{1,3})\b/;

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
  const [card, setCard] = useState<Battlecard | null>(null);
  const [moment, setMoment] = useState<MomentInfo | null>(null);

  // Wrap
  const [summary, setSummary] = useState<CallSummary | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [debrief, setDebrief] = useState<CallDebrief | null>(null);
  const [debriefing, setDebriefing] = useState(false);
  const [pastCalls, setPastCalls] = useState<CopilotCallRecord[]>([]);
  const [saved, setSaved] = useState(false);
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
  const callStartRef = useRef(0);
  const memoryRef = useRef(''); // memoria del nicho (lecciones acumuladas)
  const openerRef = useRef(''); // la apertura del briefing (se siembra en vivo)

  useEffect(() => {
    suggestionRef.current = suggestion;
  }, [suggestion]);

  // Stats legibles de la llamada (para el debrief, el comentario y el registro).
  const buildStatsLine = useCallback((): string => {
    const mins = callStartRef.current
      ? Math.max(1, Math.round((Date.now() - callStartRef.current) / 60000))
      : 0;
    const objs = Object.entries(objCountsRef.current)
      .map(([id, n]) => (n > 1 ? `${id}×${n}` : id))
      .join(', ');
    return [
      mins ? `${mins} min` : '',
      momentsSeenRef.current.length ? `Ruta: ${momentsSeenRef.current.join(' → ')}` : '',
      objs ? `Objeciones: ${objs}` : '',
      ticketRef.current != null ? `Ticket ≈ $${ticketRef.current}` : '',
      perdidosRef.current != null ? `Pierde ≈ ${perdidosRef.current}/mes` : '',
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
      suggestAbortRef.current?.abort();
      const ctrl = new AbortController();
      suggestAbortRef.current = ctrl;
      lastSuggestRef.current = Date.now();
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
            if (!acc) setTtftMs(Date.now() - t0); // primer token: latencia real
            acc += chunk;
            setSuggestion(acc);
          },
          ctrl.signal
        );
      } catch (e) {
        if (!ctrl.signal.aborted) {
          setSuggestion(`⚠️ ${e instanceof Error ? e.message : 'Coach no disponible'}`);
        }
      } finally {
        if (suggestAbortRef.current === ctrl) {
          suggestingRef.current = false;
          setSuggesting(false);
        }
      }
    },
    []
  );

  // Cada frase final: transcript + momento + objeción instantánea + coach.
  const onFinal = useCallback(
    (text: string) => {
      transcriptRef.current = `${transcriptRef.current} ${text}`.trim().slice(-6000);
      setLines((prev) => [...prev, text]);

      // 0) Filtro de eco: si es el vendedor leyendo el consejo en voz alta,
      //    entra al transcript pero NO re-dispara detección ni coach.
      const norm = normalizeSpeech(text);
      if (sharesWindow(normForEcho(text), normForEcho(suggestionRef.current))) return;

      // 0b) Números del prospecto (ticket / clientes perdidos): el ancla de
      //     toda la matemática. Solo sobre finales (texto estable).
      const mt = RE_TICKET.exec(norm);
      if (mt) ticketRef.current = Number(mt[1]);
      const mp = RE_PERDIDOS.exec(norm);
      if (mp) perdidosRef.current = Number(mp[1]);
      if (mt || mp) setNumbers({ ticket: ticketRef.current, perdidos: perdidosRef.current });

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
        setSuggestion(`⚡ **${m.label}** — ${m.bestMove}`);
      }

      // 4) Coach LLM: objeción o momento urgente → YA (supersede al anterior);
      //    si no, reactivo tras cada frase con colchón de SUGGEST_GAP_MS.
      if (lead && (hit || urgent)) {
        runSuggest(lead, text);
      } else if (lead && Date.now() - lastSuggestRef.current > SUGGEST_GAP_MS) {
        runSuggest(lead);
      }
    },
    [lead, runSuggest]
  );

  // Cada resultado PARCIAL (~300ms tras hablar): detección instantánea local.
  // El texto es inestable → no entra al transcript; pero la battlecard, el
  // chip de momento y la jugada instantánea saltan de una. Y en momentos
  // URGENTES disparamos el LLM ESPECULATIVAMENTE sobre el parcial (no
  // esperamos el cierre de frase): si el final difiere, el supersede lo
  // corrige; si coincide, ganamos ~0.5-1.5s.
  const onInterim = useCallback(
    (text: string) => {
      // Filtro de eco: el vendedor leyendo el consejo no dispara nada.
      if (sharesWindow(normForEcho(text), normForEcho(suggestionRef.current))) return;
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
          setSuggestion(`⚡ **${m.label}** — ${m.bestMove}`);
        }
        if (URGENT_MOMENTS.includes(m.id) && leadRef.current) {
          runSuggest(leadRef.current, text); // especulativo: una vez por cambio de momento
        }
      }
    },
    [runSuggest]
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
      await copilotBriefing(l, historyRef.current, memoryRef.current, (chunk) => {
        acc += chunk;
        setBriefing((s) => s + chunk);
        if (!openerRef.current) {
          const m = /"([^"\n]{40,320})"/.exec(acc);
          if (m) openerRef.current = m[1]!;
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el briefing.');
    } finally {
      setBriefLoading(false);
    }
  }

  function startListening() {
    if (!engine.supported) {
      setError('Tu navegador no soporta captura de micrófono. Usa Chrome o Edge de escritorio.');
      return;
    }
    degradedRef.current = false;
    setPhase('live');
    setLines([]);
    setSuggestion('');
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
    callStartRef.current = Date.now();
    lastSuggestRef.current = Date.now();
    // La primera jugada YA está en pantalla: tu apertura. La dices, callas,
    // y cuando el prospecto responda el coach sopla la siguiente.
    if (openerRef.current) {
      setSuggestion(
        `🎯 **Tu apertura — dila y CALLA:**\n"${openerRef.current}"\n\n*Cuando el prospecto responda, te soplo la siguiente jugada.*`
      );
    }
    copilotWarm(); // re-toque al cache por si el briefing tomó >5 min
    engine.start();
  }

  async function hangUp() {
    dg.stop();
    ws.stop();
    suggestAbortRef.current?.abort();
    setPhase('wrap');
    if (!lead) return;
    setSummarizing(true);
    setSaved(false);
    setDebrief(null);
    // Resumen y coaching corren EN PARALELO: el resumen alimenta el CRM,
    // el debrief te dice qué mejorar y actualiza la memoria del nicho.
    setDebriefing(true);
    copilotDebrief({
      lead,
      transcript: transcriptRef.current,
      stats: buildStatsLine(),
      memory: memoryRef.current,
    })
      .then(setDebrief)
      .catch(() => setDebrief(null))
      .finally(() => setDebriefing(false));
    try {
      setSummary(await copilotSummary(lead, transcriptRef.current));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el resumen.');
    } finally {
      setSummarizing(false);
    }
  }

  async function saveToLead() {
    if (!lead || !summary || saved) return;
    const statsLine = buildStatsLine();
    const body = `📞 Llamada (Copilot) — ${summary.summary}${summary.nextAction ? `\n➡️ Próxima acción: ${summary.nextAction}` : ''}${statsLine ? `\n📊 ${statsLine}` : ''}`;
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
  }

  function reset() {
    dg.stop();
    ws.stop();
    suggestAbortRef.current?.abort();
    degradedRef.current = false;
    setPhase('pick');
    setLead(null);
    leadRef.current = null;
    setBriefing('');
    setLines([]);
    setSuggestion('');
    setCard(null);
    setMoment(null);
    setDebrief(null);
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
                      <Sparkles className="h-3.5 w-3.5" /> Briefing pre-llamada
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
                    <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap pr-1 text-sm leading-relaxed text-surface-800">
                      {suggestion || (
                        <span className="text-surface-400">El coach te irá soplando la mejor jugada. Toca “Ayuda” cuando lo necesites.</span>
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

                  <div className="mt-3 flex gap-2">
                    {saved ? (
                      <span className="btn-secondary flex-1 justify-center py-3 text-emerald-600">
                        <Save className="h-4 w-4" /> Guardado en el prospecto
                      </span>
                    ) : (
                      <button className="btn-primary flex-1 py-3" onClick={saveToLead} disabled={!summary}>
                        <Save className="h-4 w-4" /> Guardar en el prospecto
                      </button>
                    )}
                    <button className="btn-secondary py-3" onClick={reset}>
                      Volver a Prospectos <ArrowRight className="h-4 w-4" />
                    </button>
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
