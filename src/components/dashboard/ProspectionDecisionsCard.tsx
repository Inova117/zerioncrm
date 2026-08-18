// ============================================================================
// ProspectionDecisionsCard — panel "Prospección de hoy" del Dashboard.
// Muestra la última decisión del sistema autónomo (qué eligió, por qué, cuánto
// trajo) y las recientes. Solo lectura: lo escribe run-campaign (service_role).
// ============================================================================
import { useEffect, useState } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { listDecisions } from '../../services/decisionsService';
import type { DecisionRecord } from '../../types';
import { nicheEntry } from '../../lib/nicheCatalog';
import { cityByKey } from '../../lib/cityCatalog';

const label = (d: DecisionRecord) =>
  `${nicheEntry(d.niche)?.label ?? d.niche} · ${cityByKey(d.city)?.label ?? d.city}`;

export function ProspectionDecisionsCard() {
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listDecisions(10)
      .then((d) => { if (alive) setDecisions(d); })
      .catch(() => { /* sin log cargable */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // Sin decisiones (mock o primer día) el panel no estorba.
  if (loading || !decisions.length) return null;

  const last = decisions[0];

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Bot className="h-4 w-4 text-brand-600" />
        <div>
          <h2 className="text-sm font-semibold text-surface-800">Prospección de hoy</h2>
          <p className="text-xs text-surface-400">Lo que el sistema eligió y trajo esta mañana.</p>
        </div>
      </div>

      <div className="rounded-lg bg-surface-50 p-4">
        <p className="text-sm font-medium text-surface-900">{last.reason}</p>
        <p className="mt-1 text-xs text-surface-500">
          {last.found} encontrados · {last.created} leads nuevos (≥ umbral) · {last.discoveries} descubiertos
        </p>
      </div>

      {decisions.length > 1 && (
        <ul className="mt-3 space-y-1.5">
          {decisions.slice(1, 5).map((d) => (
            <li key={d.id} className="flex items-center gap-2 text-xs text-surface-500">
              <Sparkles className="h-3 w-3 shrink-0 text-surface-300" />
              <span className="truncate">{label(d)} — {d.created} leads</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}