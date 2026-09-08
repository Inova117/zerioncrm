// ============================================================================
// MonidPage — centro de outreach pay-per-use (V2).
// ----------------------------------------------------------------------------
// Reemplaza 5 suscripciones en una pasarela Monid:
//   1. Apify   → buscador Google Maps (pay-per-use)
//   2. Clay    → búsqueda avanzada de personas
//   3. Apollo  → discovery de prospects
//   4. Hunter  → emails de dominio
//   5. PDL/Akta → enriquecimiento de empresa (firmographics/funding/tech)
//   6. ContactOut → decision-makers + emails laborales
// Independiente del Minero V1 (Apify, plan B intacto).
// ============================================================================
import { useEffect, useState } from 'react';
import {
  Search, Users, Globe, Mail, Building2, Contact, Wallet,
  Loader2, AlertCircle, ExternalLink, ChevronDown, Zap,
  Briefcase, Phone, BadgeCheck, MapPin, TrendingUp, Hash, CalendarDays, Sparkles,
} from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { cn } from '../lib/utils';
import {
  monidSearch, monidPeople, monidFirm, monidDecisionMakers, monidBalance, monidEnrich, monidOrchestrate, monidReveal,
  type MonidPlace, type OrchestrateResult,
} from '../v2/monid';

const inputCls =
  'rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100';

// ---------------------------------------------------------------------------
// Tipos de resultado (shapes confirmados en pruebas reales contra Monid)
// ---------------------------------------------------------------------------
interface ClayPerson {
  name?: string;
  first_name?: string;
  last_name?: string;
  location?: { name?: string; city?: string; state_or_province?: string };
  matched_experiences?: Array<{ company?: string; title?: string }>;
}
interface ApolloPerson {
  first_name?: string;
  last_name_obfuscated?: string;
  title?: string;
  organization?: { name?: string };
  has_email?: boolean;
  has_direct_phone?: string;
}
interface HunterEmail {
  email?: string;
  type?: string;
  confidence?: number;
  position?: string;
}
interface ContactPerson {
  full_name?: string;
  title?: string;
  seniority?: string;
  job_function?: string;
  contact_availability?: { work_email?: boolean; personal_email?: boolean; phone?: boolean };
}
interface FirmSignals {
  empleados?: number;
  founded?: number;
  antiguedad?: number;
  size?: string;
  industry?: string;
  totalFunding?: number;
  fundingStage?: string;
  linkedinUrl?: string;
}

// ---------------------------------------------------------------------------
// Componentes de tarjeta
// ---------------------------------------------------------------------------
function Section({ icon: Icon, title, killed, children }: {
  icon: typeof Search;
  title: string;
  killed: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-surface-900">{title}</p>
            <p className="text-xs text-surface-400">
              <span className="font-medium text-brand-600">Mata</span> {killed}
            </p>
          </div>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-surface-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="border-t border-surface-100 p-4">{children}</div>}
    </section>
  );
}

function Busy({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-surface-500">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> {text}
    </span>
  );
}

function Pill({ children, tone = 'gray' }: { children: React.ReactNode; tone?: 'gray' | 'green' | 'amber' | 'brand' }) {
  const tones = {
    gray: 'bg-surface-100 text-surface-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    brand: 'bg-brand-50 text-brand-700',
  };
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', tones[tone])}>{children}</span>;
}

// --- persona (Clay / Apollo) ---
function PersonCard({ name, title, company, meta }: {
  name: string;
  title?: string;
  company?: string;
  meta?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-surface-100 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-surface-900">{name}</p>
        {meta}
      </div>
      {title && <p className="mt-0.5 text-xs font-medium text-brand-600">{title}</p>}
      {company && <p className="text-xs text-surface-500">{company}</p>}
    </div>
  );
}

// --- email (Hunter) ---
function EmailCard({ email }: { email: HunterEmail }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-surface-100 p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-surface-900">{email.email}</p>
        {email.position && <p className="text-xs text-surface-500">{email.position}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {email.confidence != null && (
          <Pill tone={email.confidence >= 80 ? 'green' : email.confidence >= 50 ? 'amber' : 'gray'}>
            {email.confidence}% confianza
          </Pill>
        )}
        <Pill tone={email.type === 'personal' ? 'brand' : 'gray'}>{email.type === 'personal' ? 'Personal' : 'Genérico'}</Pill>
      </div>
    </div>
  );
}

// --- decision-maker (ContactOut) ---
function DecisionMakerCard({ p }: { p: ContactPerson }) {
  const av = p.contact_availability;
  return (
    <div className="rounded-lg border border-surface-100 p-3">
      <p className="text-sm font-semibold text-surface-900">{p.full_name}</p>
      {p.title && <p className="mt-0.5 text-xs font-medium text-brand-600">{p.title}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {p.seniority && <Pill tone="gray">{p.seniority}</Pill>}
        {p.job_function && <Pill tone="gray">{p.job_function}</Pill>}
        {av?.work_email && <Pill tone="green"><Mail className="h-3 w-3" /> Email laboral</Pill>}
        {av?.phone && <Pill tone="green"><Phone className="h-3 w-3" /> Teléfono</Pill>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
export function MonidPage() {
  const [balance, setBalance] = useState<{ value: number; currency: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 1 — Maps
  const [biz, setBiz] = useState('');
  const [loc, setLoc] = useState('');
  const [places, setPlaces] = useState<MonidPlace[]>([]);
  const [searchCost, setSearchCost] = useState<{ value: number; currency: string } | null>(null);
  const [searching, setSearching] = useState(false);

  // 2/3 — Personas (Clay + Apollo)
  const [clayQuery, setClayQuery] = useState('');
  const [personTitles, setPersonTitles] = useState('');
  const [clayPeople, setClayPeople] = useState<ClayPerson[]>([]);
  const [apolloPeople, setApolloPeople] = useState<ApolloPerson[]>([]);
  const [searchingPeople, setSearchingPeople] = useState(false);

  // 4 — Emails (Hunter)
  const [emailDomain, setEmailDomain] = useState('');
  const [emails, setEmails] = useState<HunterEmail[]>([]);
  const [hunting, setHunting] = useState(false);

  // 5 — Firma (PDL)
  const [firmWebsite, setFirmWebsite] = useState('');
  const [firmSignals, setFirmSignals] = useState<FirmSignals | null>(null);
  const [firming, setFirming] = useState(false);

  // 6 — Decision-makers (ContactOut)
  const [dmCompany, setDmCompany] = useState('');
  const [dmPeople, setDmPeople] = useState<ContactPerson[]>([]);
  const [dming, setDming] = useState(false);

  // Orquestación — un solo disparo
  const [prompt, setPrompt] = useState('');
  const [orch, setOrch] = useState<OrchestrateResult | null>(null);
  const [orching, setOrching] = useState(false);
  const [revealingFor, setRevealingFor] = useState<string | null>(null);

  useEffect(() => {
    monidBalance().then((b) => setBalance(b.balance)).catch(() => undefined);
  }, []);

  async function runOrchestrate(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || orching) return;
    setOrching(true);
    setError(null);
    setOrch(null);
    try {
      setOrch(await monidOrchestrate(prompt.trim(), { maxLeads: 20 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fallo la prospección completa.');
    } finally {
      setOrching(false);
    }
  }

  async function revealDm(company: string) {
    if (revealingFor) return;
    setRevealingFor(company);
    setError(null);
    try {
      const r = await monidReveal(company);
      // Reemplaza los decisionMakers de ESE lead con la versión revelada.
      const raw = (r.people as { profiles?: Record<string, unknown> } | undefined)?.profiles;
      const people = (Array.isArray(raw) ? raw : Object.values(raw ?? {})) as unknown as Record<string, unknown>[];
      setOrch((prev) => prev && {
        ...prev,
        leads: prev.leads.map((l) => (l.company === company ? { ...l, decisionMakers: people, revealed: true } : l)),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fallo la revelación de emails.');
    } finally {
      setRevealingFor(null);
    }
  }

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!biz.trim() || !loc.trim() || searching) return;
    setSearching(true);
    setError(null);
    try {
      const r = await monidSearch(biz.trim(), loc.trim(), 20);
      setPlaces(r.places);
      setSearchCost(r.cost);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fallo la búsqueda.');
    } finally {
      setSearching(false);
    }
  }

  async function runPeople(e: React.FormEvent) {
    e.preventDefault();
    if (searchingPeople) return;
    setSearchingPeople(true);
    setError(null);
    try {
      const titles = personTitles.split(',').map((s) => s.trim()).filter(Boolean);
      const r = await monidPeople({ query: clayQuery.trim() || undefined, personTitles: titles.length ? titles : undefined });
      // Clay → { data: [...] }; Apollo → { people: [...] }
      const clay = r.clay as { data?: ClayPerson[] } | undefined;
      const apollo = r.apollo as { people?: ApolloPerson[] } | undefined;
      setClayPeople(clay?.data ?? []);
      setApolloPeople(apollo?.people ?? []);
      if (!clay?.data?.length && !apollo?.people?.length) {
        setError('Sin resultados de Clay ni Apollo. Probá otro título o query.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fallo la búsqueda de personas.');
    } finally {
      setSearchingPeople(false);
    }
  }

  async function runHunter(e: React.FormEvent) {
    e.preventDefault();
    if (!emailDomain.trim() || hunting) return;
    setHunting(true);
    setError(null);
    try {
      const s = await monidEnrich({ domain: emailDomain.trim() });
      const list = s.emails ?? (s.email ? [{ email: s.email }] : []);
      setEmails(list);
      if (!list.length) setError(`Sin emails publicados para ${emailDomain.trim()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fallo la búsqueda de emails.');
    } finally {
      setHunting(false);
    }
  }

  async function runFirm(e: React.FormEvent) {
    e.preventDefault();
    if (!firmWebsite.trim() || firming) return;
    setFirming(true);
    setError(null);
    try {
      const r = await monidFirm(firmWebsite.trim());
      setFirmSignals((r.senales as FirmSignals) ?? null);
      if (!r.senales) setError('Sin datos de firma para ese sitio.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fallo el enriquecimiento.');
    } finally {
      setFirming(false);
    }
  }

  async function runDm(e: React.FormEvent) {
    e.preventDefault();
    if (!dmCompany.trim() || dming) return;
    setDming(true);
    setError(null);
    try {
      const r = await monidDecisionMakers(dmCompany.trim());
      // ContactOut devuelve `profiles` como DICCIONARIO indexado por URL de
      // LinkedIn (no un array) — aplanar a lista.
      const raw = (r.people as { profiles?: Record<string, unknown> } | undefined)?.profiles;
      const people = (Array.isArray(raw) ? raw : Object.values(raw ?? {})) as unknown as ContactPerson[];
      setDmPeople(people);
      if (!people.length) setError(`Sin decision-makers para ${dmCompany.trim()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fallo la búsqueda de decision-makers.');
    } finally {
      setDming(false);
    }
  }

  return (
    <AppLayout
      title="Monid"
      subtitle="Un solo proveedor pay-per-use para matar 5 suscripciones: Apify · Clay · Apollo · Hunter · PDL · ContactOut."
    >
      {/* Balanza + status */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3">
        <span className="inline-flex items-center gap-2 text-sm text-surface-700">
          <Zap className="h-4 w-4 text-brand-600" />
          Pasarela <span className="font-semibold">Monid</span> activa
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm text-surface-600">
          <Wallet className="h-4 w-4 text-surface-400" />
          {balance ? (
            <>Saldo <span className="font-semibold tabular-nums">{balance.currency} {balance.value.toFixed(2)}</span></>
          ) : (
            <Busy text="leyendo saldo…" />
          )}
        </span>
      </div>

      {error && (
        <p className="mb-5 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <div className="space-y-3">
        {/* 0. Orquestación — un solo disparo */}
        <section className="card overflow-hidden border-2 border-brand-200">
          <div className="p-4">
            <div className="mb-2 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-surface-900">Prospección completa</p>
                <p className="text-xs text-surface-400">Decís qué querés y el sistema decide qué tools usar — Maps, firma, emails, score y decision-makers en una corrida.</p>
              </div>
            </div>
            <form onSubmit={runOrchestrate} className="flex flex-wrap items-end gap-2">
              <label className="flex-1 min-w-[260px]">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-surface-400">Qué querés encontrar</span>
                <input
                  className={inputCls}
                  placeholder='Dame dentistas en Quito que sostengan el ticket de $500/mes'
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </label>
              <button type="submit" className="btn-primary" disabled={orching}>
                {orching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {orching ? 'Minando…' : 'Encontrar'}
              </button>
            </form>
            {orching && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-surface-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Buscando, enriqueciendo firmas, sacando emails y decision-makers… puede tardar 1–3 min.
              </p>
            )}
          </div>

          {orch && (
            <div className="border-t border-surface-100 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                <Pill tone="brand">{orch.intent.niche} · {orch.intent.city}</Pill>
                <Pill tone="gray">{orch.intent.objetivo}</Pill>
                <span className="text-surface-500">{orch.matched} de {orch.total} cumplen el objetivo</span>
              </div>
              {orch.leads.length === 0 ? (
                <p className="text-sm text-surface-500">Ningún negocio alcanzó ese nivel. Aflojá el filtro o probá otra ciudad.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {orch.leads.map((l, i) => (
                    <div key={i} className="rounded-lg border border-surface-100 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-surface-900">{l.company}</p>
                        <NivelBadge nivel={l.nivel} />
                      </div>
                      <p className="mt-0.5 text-xs text-surface-500">
                        {l.empleados != null ? `${l.empleados} empleados` : ''}
                        {l.founded != null ? ` · fundada ${l.founded}` : ''}
                        {l.industry ? ` · ${l.industry}` : ''}
                      </p>
                      {l.email && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-brand-600">
                          <Mail className="h-3 w-3" /> {l.email}
                        </p>
                      )}
                      {l.decisionMakers && l.decisionMakers.length > 0 && (
                        <div className="mt-1.5">
                          <div className="flex flex-wrap gap-1">
                            {l.decisionMakers.slice(0, 3).map((dm, j) => (
                              <Pill key={j} tone="green">
                                {(dm as { full_name?: string }).full_name?.split(' ').slice(0, 2).join(' ') ?? 'Contacto'}
                              </Pill>
                            ))}
                          </div>
                          {(revealingFor === l.company) ? (
                            <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-surface-400">
                              <Loader2 className="h-3 w-3 animate-spin" /> Revelando emails…
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => revealDm(l.company ?? '')}
                              disabled={revealingFor !== null}
                              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
                            >
                              <Mail className="h-3 w-3" /> Revelar emails (~$0.07/c/u)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* 1. Apify → Google Maps */}
        <Section icon={Search} title="Buscador local (Google Maps)" killed="Apify mensualidad → pay-per-use">
          <form onSubmit={runSearch} className="flex flex-wrap items-end gap-2">
            <label className="flex-1 min-w-[160px]">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-surface-400">Tipo de negocio</span>
              <input className={inputCls} placeholder="Dentistas, talleres…" value={biz} onChange={(e) => setBiz(e.target.value)} />
            </label>
            <label className="flex-1 min-w-[160px]">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-surface-400">Ubicación</span>
              <input className={inputCls} placeholder="Quito, Ecuador" value={loc} onChange={(e) => setLoc(e.target.value)} />
            </label>
            <button type="submit" className="btn-primary" disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar
            </button>
          </form>
          {searchCost && !searching && (
            <p className="mt-2 text-xs text-surface-500">
              Costó <span className="font-medium">{searchCost.currency} {searchCost.value.toFixed(4)}</span>
            </p>
          )}
          {places.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {places.map((p) => (
                <div key={p.placeId ?? p.company} className="rounded-lg border border-surface-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-surface-900">{p.company}</p>
                    {p.rating != null && <Pill tone="amber">★ {p.rating}</Pill>}
                  </div>
                  <p className="mt-0.5 text-xs text-surface-500">{p.type ?? p.address}</p>
                  {p.website ? (
                    <a href={p.website} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
                      <Globe className="h-3 w-3" /> {p.website.replace(/^https?:\/\//, '')} <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="mt-1.5 inline-flex items-center rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">Sin web</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 2/3. Clay + Apollo → personas */}
        <Section icon={Users} title="Prospección de personas" killed="Clay $349 · Apollo $49">
          <form onSubmit={runPeople} className="space-y-2">
            <div>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-surface-400">Query Clay (avanzado)</span>
              <textarea className={cn(inputCls, 'w-full')} rows={2} placeholder='select from people where experiences.any(is_current = true and job_title is_similar_to ("VP Sales"))' value={clayQuery} onChange={(e) => setClayQuery(e.target.value)} />
            </div>
            <div>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-surface-400">Títulos Apollo (coma-separados)</span>
              <input className={inputCls} placeholder="CEO, Founder, VP Sales" value={personTitles} onChange={(e) => setPersonTitles(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary" disabled={searchingPeople}>
              {searchingPeople ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              Buscar personas
            </button>
          </form>

          {(clayPeople.length > 0 || apolloPeople.length > 0) && (
            <div className="mt-4 space-y-4">
              {clayPeople.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-surface-400">
                    <BadgeCheck className="h-3.5 w-3.5 text-brand-500" /> Clay · {clayPeople.length} perfiles
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {clayPeople.map((p, i) => {
                      const exp = p.matched_experiences?.[0];
                      return (
                        <PersonCard
                          key={`clay-${i}`}
                          name={p.name ?? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()}
                          title={exp?.title}
                          company={exp?.company}
                          meta={p.location?.name ? <Pill tone="gray"><MapPin className="h-3 w-3" /> {p.location.name}</Pill> : undefined}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
              {apolloPeople.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-surface-400">
                    <BadgeCheck className="h-3.5 w-3.5 text-brand-500" /> Apollo · {apolloPeople.length} perfiles
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {apolloPeople.map((p, i) => (
                      <PersonCard
                        key={`apollo-${i}`}
                        name={`${p.first_name ?? ''} ${p.last_name_obfuscated ?? ''}`.trim()}
                        title={p.title}
                        company={p.organization?.name}
                        meta={p.has_email ? <Pill tone="green"><Mail className="h-3 w-3" /> Email</Pill> : undefined}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* 4. Hunter → emails */}
        <Section icon={Mail} title="Emails de empresa" killed="Hunter.io plan">
          <form onSubmit={runHunter} className="flex flex-wrap items-end gap-2">
            <label className="flex-1 min-w-[200px]">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-surface-400">Dominio</span>
              <input className={inputCls} placeholder="empresa.com" value={emailDomain} onChange={(e) => setEmailDomain(e.target.value)} />
            </label>
            <button type="submit" className="btn-primary" disabled={hunting}>
              {hunting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Buscar emails
            </button>
          </form>
          {emails.length > 0 && (
            <div className="mt-3 space-y-2">
              {emails.map((e, i) => <EmailCard key={i} email={e} />)}
            </div>
          )}
        </Section>

        {/* 5. PDL → firma */}
        <Section icon={Building2} title="Enriquecimiento de empresa" killed="PDL · Akta · Clay">
          <form onSubmit={runFirm} className="flex flex-wrap items-end gap-2">
            <label className="flex-1 min-w-[200px]">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-surface-400">Sitio web</span>
              <input className={inputCls} placeholder="https://empresa.com" value={firmWebsite} onChange={(e) => setFirmWebsite(e.target.value)} />
            </label>
            <button type="submit" className="btn-primary" disabled={firming}>
              {firming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
              Enriquecer
            </button>
          </form>
          {firmSignals && (
            <div className="mt-3 rounded-lg border border-surface-100 p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat icon={Users} label="Empleados" value={firmSignals.empleados != null ? firmSignals.empleados.toLocaleString() : '—'} />
                <Stat icon={CalendarDays} label="Fundada" value={firmSignals.founded != null ? String(firmSignals.founded) : '—'} />
                <Stat icon={Hash} label="Tamaño" value={firmSignals.size ?? '—'} />
                <Stat icon={Briefcase} label="Industria" value={firmSignals.industry ?? '—'} />
                <Stat icon={TrendingUp} label="Funding total" value={firmSignals.totalFunding != null ? `$${(firmSignals.totalFunding / 1e6).toFixed(1)}M` : '—'} />
                <Stat icon={Zap} label="Stage" value={firmSignals.fundingStage ?? '—'} />
              </div>
              {firmSignals.linkedinUrl && (
                <a href={`https://${firmSignals.linkedinUrl.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
                  <ExternalLink className="h-3 w-3" /> LinkedIn
                </a>
              )}
            </div>
          )}
        </Section>

        {/* 6. ContactOut → decision-makers */}
        <Section icon={Contact} title="Decision-makers" killed="ContactOut">
          <form onSubmit={runDm} className="flex flex-wrap items-end gap-2">
            <label className="flex-1 min-w-[200px]">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-surface-400">Empresa (nombre o dominio)</span>
              <input className={inputCls} placeholder="Stripe" value={dmCompany} onChange={(e) => setDmCompany(e.target.value)} />
            </label>
            <button type="submit" className="btn-primary" disabled={dming}>
              {dming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Contact className="h-4 w-4" />}
              Buscar
            </button>
          </form>
          {dmPeople.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {dmPeople.map((p, i) => <DecisionMakerCard key={i} p={p} />)}
            </div>
          )}
        </Section>
      </div>
    </AppLayout>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-surface-400">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-surface-900">{value}</p>
    </div>
  );
}

function NivelBadge({ nivel }: { nivel: string }) {
  if (nivel === 'sostiene') return <Pill tone="green">Sostiene el ticket</Pill>;
  if (nivel === 'probable') return <Pill tone="amber">Probable</Pill>;
  if (nivel === 'no') return <Pill tone="gray">No</Pill>;
  return <Pill tone="gray">Sin datos</Pill>;
}