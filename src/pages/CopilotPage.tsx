import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Sparkles, Mic, MicOff, Phone, PhoneOff, LifeBuoy, Search as SearchIcon,
  Star, Globe, MapPin, Loader2, AlertTriangle, Save, ArrowRight, Radar, SlidersHorizontal,
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
import { copilotBriefing, copilotSuggest, copilotSummary, type CallSummary } from '../services/copilotService';
import { detectObjection, detectMoment, type Battlecard, type MomentInfo } from '../data/salesPlaybook';
import type { Lead } from '../types';
import { cn, colorFromString, initials, telLink, waLink, webLink, googleMapsUrl, fmtDate } from '../lib/utils';
import { stageLabel } from '../lib/constants';

type Phase = 'pick' | 'brief' | 'live' | 'wrap';
const AUTO_SUGGEST_MS = 15000; // coach espontáneo cada ~15s si hay transcript nuevo

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
  const { user, isAdmin } = useAuth();
  const { leads, addComment, moveLead, createTask, loadComments } = useData();
  const [params, setParams] = useSearchParams();

  const [phase, setPhase] = useState<Phase>('pick');
  const [lead, setLead] = useState<Lead | null>(null);
  const [query, setQuery] = useState('');
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
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transcriptRef = useRef('');
  const historyRef = useRef('');
  const momentRef = useRef<MomentInfo | null>(null);
  const lastSuggestRef = useRef(0);
  const linesEndRef = useRef<HTMLDivElement | null>(null);

  const myLeads = useMemo(() => {
    const scoped = isAdmin ? leads : leads.filter((l) => l.assignedTo === user?.id);
    const q = query.trim().toLowerCase();
    const list = q
      ? scoped.filter((l) => l.company.toLowerCase().includes(q) || l.industry.toLowerCase().includes(q))
      : scoped;
    return [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [leads, isAdmin, user, query]);

  // Lanzamiento con ?lead=<id> desde el detalle del prospecto.
  useEffect(() => {
    const id = params.get('lead');
    if (id && phase === 'pick') {
      const found = leads.find((l) => l.id === id);
      if (found) startBriefing(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, leads]);

  // --- Coach (streaming) -----------------------------------------------------
  const runSuggest = useCallback(
    async (l: Lead, trigger?: string) => {
      lastSuggestRef.current = Date.now();
      setSuggesting(true);
      setSuggestion('');
      try {
        await copilotSuggest(
          {
            lead: l,
            transcript: transcriptRef.current,
            trigger,
            history: historyRef.current,
            moment: momentRef.current ? `${momentRef.current.label}: ${momentRef.current.bestMove}` : undefined,
          },
          (chunk) => setSuggestion((s) => s + chunk)
        );
      } catch (e) {
        setSuggestion(`⚠️ ${e instanceof Error ? e.message : 'Coach no disponible'}`);
      } finally {
        setSuggesting(false);
      }
    },
    []
  );

  // Cada frase final: transcript + momento + objeción instantánea + coach.
  const onFinal = useCallback(
    (text: string) => {
      transcriptRef.current = `${transcriptRef.current} ${text}`.trim().slice(-6000);
      setLines((prev) => [...prev, text]);

      // 1) ¿En qué momento de la llamada estamos? (regex, instantáneo)
      const m = detectMoment(text);
      if (m) {
        momentRef.current = m;
        setMoment(m);
      }

      // 2) Battlecard de objeción (respuesta lista sin esperar al LLM)
      const hit = detectObjection(text);
      if (hit) setCard(hit);

      // 3) ¿Cuándo llamar al coach? Objeción y momentos urgentes → YA;
      //    si no, coach espontáneo cada AUTO_SUGGEST_MS.
      const urgent = m && ['senal-compra', 'peligro', 'gatekeeper', 'precio', 'cierre'].includes(m.id);
      if (lead && (hit || urgent)) {
        runSuggest(lead, text);
      } else if (lead && Date.now() - lastSuggestRef.current > AUTO_SUGGEST_MS) {
        runSuggest(lead);
      }
    },
    [lead, runSuggest]
  );

  // Dos motores de transcripción; misma interfaz. Deepgram (premium) si está
  // configurado y disponible; si no, Web Speech del navegador (gratis).
  const dg = useDeepgram({ lang: 'es-EC', onFinal });
  const ws = useSpeech({ lang: 'es-EC', onFinal });
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
    setPhase('brief');
    setBriefing('');
    setBriefLoading(true);
    setError(null);
    // El coach conoce al prospecto: cargamos su historial (llamadas/notas previas).
    const comments = await loadComments(l.id).catch(() => []);
    historyRef.current = buildHistory(comments, l);
    try {
      await copilotBriefing(l, historyRef.current, (chunk) => setBriefing((s) => s + chunk));
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
    momentRef.current = null;
    transcriptRef.current = '';
    lastSuggestRef.current = Date.now();
    engine.start();
  }

  async function hangUp() {
    dg.stop();
    ws.stop();
    setPhase('wrap');
    if (!lead) return;
    setSummarizing(true);
    setSaved(false);
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
    const body = `📞 Llamada (Copilot) — ${summary.summary}${summary.nextAction ? `\n➡️ Próxima acción: ${summary.nextAction}` : ''}`;
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
    degradedRef.current = false;
    setPhase('pick');
    setLead(null);
    setBriefing('');
    setLines([]);
    setSuggestion('');
    setCard(null);
    setMoment(null);
    momentRef.current = null;
    setSummary(null);
    setSaved(false);
    setError(null);
    transcriptRef.current = '';
    historyRef.current = '';
    if (params.get('lead')) setParams({}, { replace: true });
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

        {/* ------------------------------------------------------ PICK */}
        {phase === 'pick' && (
          <div className="mx-auto w-full max-w-2xl">
            <div className="relative mb-3">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
              <input
                className="input pl-9"
                placeholder="Busca el prospecto a llamar…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {myLeads.length === 0 ? (
              <EmptyState
                icon={<Radar className="h-10 w-10" />}
                title="No hay prospectos para llamar"
                description="Encuentra negocios en el Lead Finder y guárdalos; luego llámalos desde aquí con el copiloto."
              />
            ) : (
              <div className="space-y-1.5">
                {myLeads.slice(0, 40).map((l) => (
                  <button
                    key={l.id}
                    onClick={() => startBriefing(l)}
                    className="card flex w-full items-center gap-3 p-3 text-left transition-shadow hover:shadow-card-hover"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                      style={{ backgroundColor: colorFromString(l.company) }}
                    >
                      {initials(l.company) || '?'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-surface-900">{l.company}</p>
                      <p className="truncate text-xs text-surface-500">
                        {l.phone || 'sin teléfono'}
                        {!l.website.trim() && ' · sin sitio web'}
                        {l.enrichment?.city ? ` · ${l.enrichment.city}` : ''}
                      </p>
                    </div>
                    <TemperatureBadge temperature={l.temperature} />
                    <Phone className="h-4 w-4 text-brand-600" />
                  </button>
                ))}
              </div>
            )}
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
                  <button className="btn-primary w-full py-3 text-base" onClick={startListening}>
                    <Mic className="h-5 w-5" /> Empezar a escuchar la llamada
                  </button>
                </>
              )}

              {phase === 'live' && (
                <>
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
                      Otra llamada <ArrowRight className="h-4 w-4" />
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
