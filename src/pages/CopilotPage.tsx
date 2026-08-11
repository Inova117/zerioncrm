import { useCallback, useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles, Phone, PhoneOff, BookOpen,
  Star, Globe, MapPin, Loader2, AlertTriangle, Save, ArrowRight, SlidersHorizontal,
} from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { CopilotSettingsModal } from '../components/copilot/CopilotSettingsModal';
import { hasCopilotSettings } from '../lib/copilotSettings';
import { EmptyState } from '../components/ui/misc';
import { TemperatureBadge } from '../components/ui/TemperatureBadge';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { SalesScriptPanel } from '../components/copilot/SalesScriptPanel';
import { CallSurveyModal } from '../components/copilot/CallSurveyModal';
import { EMPTY_SURVEY, surveyLabel } from '../data/callSurvey';
import type { CallSurveyAnswers } from '../types';
import {
  saveCopilotCall, listCopilotCalls, summarizeFromSurvey,
  type CallSummary, type CopilotCallRecord, type CallOutcome,
} from '../services/copilotService';
import type { Lead } from '../types';
import { cn, colorFromString, initials, telLink, waLink, webLink, googleMapsUrl, fmtDate } from '../lib/utils';
import { stageLabel } from '../lib/constants';

type Phase = 'pick' | 'call' | 'wrap';

export function CopilotPage() {
  const { user } = useAuth();
  const { leads, addComment, moveLead, createTask } = useData();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('pick');
  const [lead, setLead] = useState<Lead | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasSettings, setHasSettings] = useState(() => hasCopilotSettings());

  // Wrap
  const [summary, setSummary] = useState<CallSummary | null>(null);
  // $ realmente cobrado en esta llamada. Se pregunta (no se adivina): el cash
  // cobrado es la métrica que sostiene el caso de estudio y tiene que ser real.
  const [cashCollected, setCashCollected] = useState('');
  // Respuestas de la encuesta de la llamada ACTUAL (vacías = no respondida).
  // Al colgar se abre la encuesta; sus respuestas SON el reporte.
  const [survey, setSurvey] = useState<CallSurveyAnswers>(EMPTY_SURVEY);
  const [surveyOpen, setSurveyOpen] = useState(false);
  // El resumen de esta llamada se armó con la encuesta (sin transcripción).
  const [reportFromSurvey, setReportFromSurvey] = useState(false);
  const surveyRef = useRef<CallSurveyAnswers>(EMPTY_SURVEY);
  const [pastCalls, setPastCalls] = useState<CopilotCallRecord[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const callStartRef = useRef(0);

  // Lanzamiento con ?lead=<id> desde el detalle del prospecto.
  useEffect(() => {
    const id = params.get('lead');
    if (id && phase === 'pick') {
      const found = leads.find((l) => l.id === id);
      if (found) startCall(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, leads]);

  // La llamada arranca DIRECTO en el guion: sin briefing del LLM, sin
  // transcripción, sin coach. El vendedor llama desde la ficha (botones de
  // teléfono/WhatsApp), lee el guion central en pantalla y al terminar
  // responde la encuesta — el reporte se arma solo.
  function startCall(l: Lead) {
    setLead(l);
    setPhase('call');
    setError(null);
    setSaved(false);
    setSummary(null);
    setPastCalls([]);
    listCopilotCalls(l.id).then(setPastCalls).catch(() => {});
    callStartRef.current = Date.now();
    // Encuesta de la llamada NUEVA: la anterior no debe filtrar al outcome.
    setSurvey(EMPTY_SURVEY);
    surveyRef.current = EMPTY_SURVEY;
    setSurveyOpen(false);
    setReportFromSurvey(false);
  }

  function hangUp() {
    if (!lead) return;
    setPhase('wrap');
    setSaved(false);
    setCashCollected('');
    setReportFromSurvey(false);
    // La encuesta post-llamada se abre SIEMPRE al colgar: sus respuestas
    // alimentan las métricas reales y son el reporte de la llamada.
    setSurveyOpen(true);
  }

  // Encuesta respondida: sus respuestas SON el resumen (temperatura del
  // pipeline + próxima acción) y el outcome medible del dashboard.
  function handleSurveySave(answers: CallSurveyAnswers) {
    surveyRef.current = answers;
    setSurvey(answers);
    setSurveyOpen(false);
    if (!lead) return;
    setSummary(summarizeFromSurvey(answers, lead));
    setReportFromSurvey(true);
  }

  // Encuesta saltada (X): sin reporte no hay nada que guardar — el resumen
  // queda pendiente hasta responder la encuesta (botón "Responder" del wrap).
  function handleSurveySkip() {
    setSurveyOpen(false);
  }

  // Stats legibles de la llamada (para el comentario y el registro).
  const buildStatsLine = useCallback((): string => {
    const mins = callStartRef.current
      ? Math.max(1, Math.round((Date.now() - callStartRef.current) / 60000))
      : 0;
    return mins ? `${mins} min` : '';
  }, []);

  // El resultado ESTRUCTURADO de la llamada — lo que se puede medir. Es la
  // materia prima del dashboard (embudo, close rate, cash). Sin transcripción,
  // los indicadores del embudo salen de la ENCUESTA del vendedor.
  const buildOutcome = useCallback(
    (temperature: string, cash: number): CallOutcome => ({
      apertura: 'A',
      durationMin: callStartRef.current
        ? Math.max(1, Math.round((Date.now() - callStartRef.current) / 60000))
        : 0,
      contacto: survey.resultado === 'contacto',
      llegoAOferta: survey.oferta === 'si',
      horaAmarrada: survey.hora === 'amarrada',
      cerrado: temperature === 'cliente',
      cashCollected: temperature === 'cliente' ? cash : 0,
      objeciones: {},
      ticket: null,
      perdidos: null,
      momentos: [],
      // Encuesta post-llamada: si se respondió, queda en el outcome medible.
      survey: survey.resultado ? survey : null,
    }),
    [survey]
  );

  async function saveToLead() {
    // savingRef, no estado: dos clicks en el mismo tick pasarían un guard de
    // useState (el re-render llega después) y duplicarían comentario + tarea.
    if (!lead || !summary || saved || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const statsLine = buildStatsLine();
    // Respuestas de la encuesta post-llamada (si se respondió) — quedan en el
    // comentario del prospecto y en el outcome medible del dashboard.
    const surveyLine = survey.resultado
      ? `\n📝 Encuesta: ${surveyLabel('resultado', survey.resultado)} · objeción: ${survey.objecion ? surveyLabel('objecion', survey.objecion) : 'ninguna'} · oferta: ${survey.oferta === 'si' ? 'sí' : 'no'} · ver página: ${surveyLabel('hora', survey.hora)} · desenlace: ${surveyLabel('desenlace', survey.desenlace)}`
      : '';
    const body = `📞 Llamada (Copilot) — ${summary.summary}${summary.nextAction ? `\n➡️ Próxima acción: ${summary.nextAction}` : ''}${statsLine ? `\n📊 ${statsLine}` : ''}${surveyLine}`;
    try {
      // La llamada queda registrada con el reporte de la encuesta (medible).
      saveCopilotCall({
        leadId: lead.id,
        transcript: '',
        summary: summary.summary,
        temperature: summary.temperature,
        nextAction: summary.nextAction,
        stats: statsLine,
        coaching: '',
        outcome: buildOutcome(summary.temperature, Number(cashCollected) || 0),
      }).catch(() => {});
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

  // Volver a llamar al MISMO prospecto sin dar la vuelta por Prospectos.
  function callAgain() {
    if (!lead) return;
    const l = lead;
    setSummary(null);
    setSaved(false);
    setError(null);
    setCashCollected('');
    startCall(l);
  }

  function reset() {
    setPhase('pick');
    setLead(null);
    setSummary(null);
    setSaved(false);
    setError(null);
    setPastCalls([]);
    setSurvey(EMPTY_SURVEY);
    surveyRef.current = EMPTY_SURVEY;
    setSurveyOpen(false);
    setReportFromSurvey(false);
    if (params.get('lead')) setParams({}, { replace: true });
    // El copilot vive DENTRO del flujo de prospectos: al terminar, de vuelta.
    navigate('/leads');
  }

  if (!user) return null;

  return (
    <AppLayout
      title="Sales Copilot"
      subtitle="El guion de venta a la vista — léelo durante la llamada y responde la encuesta al terminar."
      fullBleed
      actions={
        <button
          className={cn('btn-secondary', !hasSettings && 'ring-1 ring-brand-300')}
          onClick={() => setSettingsOpen(true)}
          title="Tus precios y tu oferta — se resuelven en el guion"
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
              icon={<BookOpen className="h-10 w-10" />}
              title="El copilot se abre desde un prospecto"
              description='Ve a Prospectos, abre el negocio que vas a contactar y pulsa "Sales Copilot". El guion de venta aparece en pantalla; al terminar la llamada responde la encuesta.'
              action={
                <RouterLink to="/leads" className="btn-primary">
                  Ir a Prospectos <ArrowRight className="h-4 w-4" />
                </RouterLink>
              }
            />
          </div>
        )}

        {/* --------------------------------------------- CALL: guion central */}
        {phase === 'call' && lead && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <LeadHeader lead={lead} onBack={reset} />

            {pastCalls.length > 0 && (
              <details className="card px-3 py-2">
                <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-surface-400">
                  📼 Llamadas anteriores con este prospecto ({pastCalls.length})
                </summary>
                <div className="mt-2 max-h-44 space-y-2 overflow-y-auto">
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
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            )}

            {/* El guion — la pantalla principal de la llamada */}
            <div className="min-h-0 flex-1">
              <SalesScriptPanel key={lead.id} lead={lead} script={lead.script} large />
            </div>

            <button className="btn-danger w-full py-4 text-base" onClick={hangUp}>
              <PhoneOff className="h-5 w-5" /> Terminar llamada
            </button>
          </div>
        )}

        {/* --------------------------------------------- WRAP: reporte */}
        {phase === 'wrap' && lead && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <LeadHeader lead={lead} onBack={reset} />

            <div className="card flex min-h-0 flex-1 flex-col p-4">
              <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-500">
                <Sparkles className="h-3.5 w-3.5" /> Resumen de la llamada
              </p>
              {summary ? (
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  <p className="text-sm leading-relaxed text-surface-700">{summary.summary}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-surface-400">Temperatura sugerida:</span>
                    <TemperatureBadge temperature={summary.temperature} />
                  </div>

                  {/* Cash cobrado: solo si la llamada cerró. Se PREGUNTA en vez
                      de adivinarse — es el número que sostiene el caso de estudio. */}
                  {summary.temperature === 'cliente' && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                      <label className="block">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                          💵 ¿Cuánto cobraste en esta llamada?
                        </span>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="text-sm font-semibold text-emerald-700">$</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            inputMode="decimal"
                            className="input flex-1"
                            placeholder={lead?.value ? String(lead.value) : '300'}
                            value={cashCollected}
                            onChange={(e) => setCashCollected(e.target.value)}
                          />
                        </div>
                        <span className="mt-1 block text-[11px] text-emerald-700/70">
                          Lo COBRADO hoy, no lo prometido. Alimenta tu tasa de cierre y el cash del dashboard.
                        </span>
                      </label>
                    </div>
                  )}
                  {summary.nextAction && (
                    <div className="rounded-lg border border-surface-200 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-surface-400">Próxima acción</p>
                      <p className="text-sm text-surface-700">{summary.nextAction}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center text-surface-400">
                  <p className="max-w-sm text-center text-sm">
                    Sin reporte todavía — responde la encuesta post-llamada para armar el resumen y
                    el seguimiento.
                  </p>
                </div>
              )}

              {/* Encuesta post-llamada: estado + reabrir. Sus respuestas SON el reporte. */}
              <div className="rounded-lg border border-surface-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-400">
                    📝 Encuesta post-llamada
                  </p>
                  <button
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                    onClick={() => setSurveyOpen(true)}
                  >
                    {survey.resultado ? 'Editar' : 'Responder'}
                  </button>
                </div>
                {reportFromSurvey ? (
                  <p className="mt-1 text-xs text-surface-500">
                    Reporte armado con la encuesta del vendedor.
                  </p>
                ) : survey.resultado ? (
                  <p className="mt-1 text-xs text-surface-500">
                    Respondida — se suma al comentario del prospecto y a las métricas.
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-surface-500">Aún sin responder.</p>
                )}
              </div>

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
                    title="Volver al guion para una nueva llamada con este prospecto"
                  >
                    <Phone className="h-4 w-4" /> Llamar de nuevo
                  </button>
                  <button className="btn-secondary flex-1 py-3" onClick={reset}>
                    Volver a Prospectos <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <CopilotSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => setHasSettings(hasCopilotSettings())}
      />

      {/* Encuesta post-llamada: se abre al colgar (y se puede reabrir desde el wrap). */}
      <CallSurveyModal
        open={surveyOpen}
        onClose={handleSurveySkip}
        onSave={handleSurveySave}
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
