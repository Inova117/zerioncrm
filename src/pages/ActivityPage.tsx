import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ClipboardList, Loader2, Save, TrendingUp, Users } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { dailyActivityService } from '../services/dailyActivityService';
import type { DailyActivity } from '../types';
import { dayKey, mondayOf, weekDays, activityTotals, rowForDay } from '../lib/dailyActivityUtils';
import { cn } from '../lib/utils';

const DOW = ['lun', 'mar', 'mié', 'jue', 'vie'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "10 – 14 ago" para el selector de semana. */
function weekLabel(days: Date[]): string {
  const a = days[0]!;
  const b = days[4]!;
  return `${a.getDate()} – ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}

export function ActivityPage() {
  const { user, isAdmin } = useAuth();
  const { users } = useData();
  const [params] = useSearchParams();

  // Modo supervisor: ?u=<userId> — el admin revisa el diario de un empleado
  // (solo lectura; el empleado es responsable de SU registro).
  const subjectId = params.get('u');
  const subject = subjectId ? (users.find((u) => u.id === subjectId) ?? null) : null;
  const isSupervisor = Boolean(subjectId && subject && isAdmin);
  const userId = isSupervisor ? subject!.id : user?.id ?? '';

  const today = new Date();
  const todayKey = dayKey(today);
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(today));
  const [rows, setRows] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(true);

  // Día seleccionado (default: hoy).
  const [selectedDay, setSelectedDay] = useState<string>(todayKey);
  const [form, setForm] = useState({ calls: '', contacts: '', demos: '', closes: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const fromKey = dayKey(days[0]!);
  const toKey = dayKey(days[4]!);
  const canGoNext = toKey < todayKey;

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    dailyActivityService
      .listFor(userId, fromKey, toKey)
      .then(setRows)
      .catch(() => setError('No se pudo cargar la actividad — reintenta.'))
      .finally(() => setLoading(false));
  }, [userId, fromKey, toKey]);

  // Vista de admin: los reportes de los empleados DEBAJO de mi actividad, en la
  // misma semana seleccionada (solo lectura — cada empleado registra lo suyo).
  const activeEmployees = useMemo(
    () => (isAdmin ? users.filter((u) => u.role === 'employee' && u.active) : []),
    [users, isAdmin]
  );
  const [teamRows, setTeamRows] = useState<DailyActivity[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  useEffect(() => {
    if (!isAdmin || isSupervisor || activeEmployees.length === 0) {
      setTeamRows([]);
      setTeamLoading(false);
      return;
    }
    setTeamLoading(true);
    dailyActivityService
      .listRange(
        activeEmployees.map((u) => u.id),
        fromKey,
        toKey
      )
      .then(setTeamRows)
      .catch(() => setTeamRows([]))
      .finally(() => setTeamLoading(false));
  }, [isAdmin, isSupervisor, activeEmployees, fromKey, toKey]);

  function selectDay(d: Date) {
    if (dayKey(d) > todayKey) return; // el futuro no se registra
    setSelectedDay(dayKey(d));
    const r = rowForDay(rows, dayKey(d));
    setForm({
      calls: r ? String(r.calls) : '',
      contacts: r ? String(r.contacts) : '',
      demos: r ? String(r.demos) : '',
      closes: r ? String(r.closes) : '',
      notes: r ? r.notes : '',
    });
  }

  async function save() {
    if (!userId) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await dailyActivityService.save({
        userId,
        day: selectedDay,
        calls: Number(form.calls) || 0,
        contacts: Number(form.contacts) || 0,
        demos: Number(form.demos) || 0,
        closes: Number(form.closes) || 0,
        notes: form.notes,
      });
      setRows((prev) =>
        [...prev.filter((r) => r.day !== saved.day), saved].sort((a, b) => a.day.localeCompare(b.day))
      );
    } catch {
      setError('No se pudo guardar — reintenta.');
    } finally {
      setSaving(false);
    }
  }

  const totals = activityTotals(rows);

  if (!user) return null;

  const title = isSupervisor ? `Actividad de ${subject!.name}` : 'Mi actividad';
  const subtitle = isSupervisor
    ? `Diario de prospección de ${subject!.name} — semana del ${weekLabel(days)}.`
    : 'Registra qué hiciste hoy: llamadas, contactos, demos y cierres. Toma 30 segundos.';

  return (
    <AppLayout title={title} subtitle={subtitle}>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {/* Selector de semana */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          className="btn-secondary px-2.5 py-1.5"
          onClick={() => setWeekStart((w) => new Date(w.getFullYear(), w.getMonth(), w.getDate() - 7))}
          title="Semana anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-32 text-center text-sm font-semibold text-surface-700">{weekLabel(days)}</span>
        <button
          className="btn-secondary px-2.5 py-1.5"
          onClick={() => setWeekStart((w) => new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7))}
          disabled={!canGoNext}
          title="Semana siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          className="btn-ghost px-2 py-1 text-xs text-brand-600"
          onClick={() => {
            setWeekStart(mondayOf(today));
            selectDay(today);
          }}
        >
          Hoy
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
        {/* Form del día (solo el dueño del registro) */}
        {!isSupervisor && (
          <div className="card h-fit p-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-500">
              Registra tu día — {selectedDay === todayKey ? 'hoy' : selectedDay}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['calls', 'Llamadas'],
                  ['contacts', 'Contactos (dueño)'],
                  ['demos', 'Demos (vio su página)'],
                  ['closes', 'Cierres'],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="block">
                  <span className="text-xs text-surface-500">{label}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    className="input mt-1 w-full"
                    placeholder="0"
                    value={form[k]}
                    onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
            <label className="mt-2 block">
              <span className="text-xs text-surface-500">Nota del día (opcional)</span>
              <textarea
                className="input mt-1 min-h-20 w-full resize-y text-sm"
                placeholder="¿Qué pasó? ¿Qué aprendiste? ¿A quién seguir mañana?"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
            <button className="btn-primary mt-3 w-full py-2.5" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar día
            </button>
          </div>
        )}

        {/* Semana en tabla */}
        <div className="card p-4">
          <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-surface-400">
            <ClipboardList className="h-3.5 w-3.5" /> Semana
          </p>
          {loading ? (
            <div className="flex h-40 items-center justify-center text-surface-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-surface-400">
                    <th className="pb-2 pr-2">Día</th>
                    <th className="pb-2 pr-2 text-center">Llamadas</th>
                    <th className="pb-2 pr-2 text-center">Contactos</th>
                    <th className="pb-2 pr-2 text-center">Demos</th>
                    <th className="pb-2 text-center">Cierres</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => {
                    const k = dayKey(d);
                    const r = rowForDay(rows, k);
                    const isFuture = k > todayKey;
                    const isSelected = k === selectedDay;
                    const logged = r && (r.calls + r.contacts + r.demos + r.closes > 0 || r.notes.trim());
                    return (
                      <tr
                        key={k}
                        onClick={() => !isSupervisor && selectDay(d)}
                        title={r?.notes ? `📝 ${r.notes}` : undefined}
                        className={cn(
                          'border-t border-surface-100',
                          !isSupervisor && !isFuture && 'cursor-pointer hover:bg-brand-50/40',
                          isSelected && 'bg-brand-50/60',
                          isFuture && 'opacity-40'
                        )}
                      >
                        <td className="py-2 pr-2 font-medium text-surface-700">
                          {DOW[(d.getDay() + 6) % 7]} {d.getDate()}
                          {logged && <span className="ml-1 text-emerald-500">●</span>}
                          {isSelected && !isSupervisor && (
                            <span className="ml-1 text-[10px] font-bold text-brand-500">EDITANDO</span>
                          )}
                        </td>
                        <td className="py-2 pr-2 text-center text-surface-700">{r ? r.calls : '—'}</td>
                        <td className="py-2 pr-2 text-center text-surface-700">{r ? r.contacts : '—'}</td>
                        <td className="py-2 pr-2 text-center text-surface-700">{r ? r.demos : '—'}</td>
                        <td className="py-2 text-center font-semibold text-emerald-700">{r ? r.closes : '—'}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-surface-200 font-semibold text-surface-800">
                    <td className="py-2 pr-2">Total</td>
                    <td className="py-2 pr-2 text-center">{totals.calls}</td>
                    <td className="py-2 pr-2 text-center">{totals.contacts}</td>
                    <td className="py-2 pr-2 text-center">{totals.demos}</td>
                    <td className="py-2 text-center text-emerald-700">{totals.closes}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Ratios de la semana */}
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-surface-500">
            <span className="rounded-full bg-surface-100 px-2.5 py-1">
              <TrendingUp className="mr-1 inline h-3 w-3 text-brand-500" />
              {totals.contactRate}% de llamadas → contacto
            </span>
            <span className="rounded-full bg-surface-100 px-2.5 py-1">
              <TrendingUp className="mr-1 inline h-3 w-3 text-brand-500" />
              {totals.demoRate}% de llamadas → demo
            </span>
            <span className="rounded-full bg-surface-100 px-2.5 py-1">
              <TrendingUp className="mr-1 inline h-3 w-3 text-emerald-600" />
              {totals.closeRate}% de demos → cierre
            </span>
            <span className="rounded-full bg-surface-100 px-2.5 py-1">{totals.daysLogged}/5 días con registro</span>
          </div>
        </div>
      </div>

      {/* Reportes del equipo DEBAJO de mi actividad (admin) — misma semana,
          solo lectura. Cada empleado registra su propio diario. */}
      {isAdmin && !isSupervisor && activeEmployees.length > 0 && (
        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-surface-800">
              Reportes del equipo — semana del {weekLabel(days)}
            </h2>
          </div>

          {teamLoading ? (
            <div className="flex h-24 items-center justify-center text-surface-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            activeEmployees.map((u) => {
              const empRows = teamRows.filter((r) => r.userId === u.id);
              const t = activityTotals(empRows);
              const anyLogged = empRows.some(
                (r) => r.calls + r.contacts + r.demos + r.closes > 0 || r.notes.trim()
              );
              return (
                <div key={u.id} className="card p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-surface-800">{u.name}</p>
                      {!anyLogged && (
                        <span className="badge bg-red-50 text-red-600">Sin registro esta semana</span>
                      )}
                    </div>
                    <Link
                      to={`/actividad?u=${u.id}`}
                      className="text-xs font-medium text-brand-600 hover:underline"
                    >
                      Ver su diario completo →
                    </Link>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wide text-surface-400">
                          <th className="pb-2 pr-2">Día</th>
                          <th className="pb-2 pr-2 text-center">Llamadas</th>
                          <th className="pb-2 pr-2 text-center">Contactos</th>
                          <th className="pb-2 pr-2 text-center">Demos</th>
                          <th className="pb-2 text-center">Cierres</th>
                        </tr>
                      </thead>
                      <tbody>
                        {days.map((d) => {
                          const k = dayKey(d);
                          const r = rowForDay(empRows, k);
                          const logged = r && (r.calls + r.contacts + r.demos + r.closes > 0 || r.notes.trim());
                          return (
                            <tr key={k} className="border-t border-surface-100" title={r?.notes ? `📝 ${r.notes}` : undefined}>
                              <td className="py-1.5 pr-2 font-medium text-surface-700">
                                {DOW[(d.getDay() + 6) % 7]} {d.getDate()}
                                {logged && <span className="ml-1 text-emerald-500">●</span>}
                              </td>
                              <td className="py-1.5 pr-2 text-center text-surface-700">{r ? r.calls : '—'}</td>
                              <td className="py-1.5 pr-2 text-center text-surface-700">{r ? r.contacts : '—'}</td>
                              <td className="py-1.5 pr-2 text-center text-surface-700">{r ? r.demos : '—'}</td>
                              <td className="py-1.5 text-center font-semibold text-emerald-700">{r ? r.closes : '—'}</td>
                            </tr>
                          );
                        })}
                        <tr className="border-t-2 border-surface-200 font-semibold text-surface-800">
                          <td className="py-1.5 pr-2">Total</td>
                          <td className="py-1.5 pr-2 text-center">{t.calls}</td>
                          <td className="py-1.5 pr-2 text-center">{t.contacts}</td>
                          <td className="py-1.5 pr-2 text-center">{t.demos}</td>
                          <td className="py-1.5 text-center text-emerald-700">{t.closes}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-2 text-xs text-surface-500">
                    <span className="rounded-full bg-surface-100 px-2.5 py-1">
                      {t.closeRate}% demos → cierre
                    </span>
                    <span className="rounded-full bg-surface-100 px-2.5 py-1">{t.daysLogged}/5 días</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </AppLayout>
  );
}
