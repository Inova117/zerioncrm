import { useState } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { PageLoader, EmptyState } from '../components/ui/misc';
import { useRoadmap } from '../hooks/useRoadmap';
import { RoadmapTabs } from '../components/roadmap/RoadmapTabs';
import type { RoadmapTabKey } from '../components/roadmap/RoadmapTabs';
import { HoyTab } from '../components/roadmap/HoyTab';
import { PanelTab } from '../components/roadmap/PanelTab';
import { SemanasTab } from '../components/roadmap/SemanasTab';
import { FinanzasTab } from '../components/roadmap/FinanzasTab';
import { RoadmapTab } from '../components/roadmap/RoadmapTab';

/**
 * Roadmap Zerion (Guía Diaria V1) — módulo personal del fundador.
 * La ruta está protegida con ownerOnly (solo el admin id 117mgd…).
 */
export function RoadmapPage() {
  const { doc, loading, error, ...actions } = useRoadmap();
  const [tab, setTab] = useState<RoadmapTabKey>('hoy');

  const subtitle = doc
    ? `Guía diaria · ${doc.meta.planStart} → 1-nov-2026 · 12 semanas`
    : 'Tu hoja de ruta de ventas, conectada';

  return (
    <AppLayout title="Roadmap Zerion" subtitle={subtitle}>
      <div className="mb-4">
        <RoadmapTabs active={tab} onChange={setTab} />
      </div>

      {loading ? (
        <PageLoader label="Cargando tu roadmap…" />
      ) : error || !doc ? (
        <EmptyState
          title="No se pudo cargar el roadmap"
          description={error ?? 'Intenta recargar la página.'}
        />
      ) : tab === 'hoy' ? (
        <HoyTab {...doc} {...actions} />
      ) : tab === 'panel' ? (
        <PanelTab {...doc} {...actions} />
      ) : tab === 'semanas' ? (
        <SemanasTab {...doc} />
      ) : tab === 'finanzas' ? (
        <FinanzasTab {...doc} {...actions} />
      ) : (
        <RoadmapTab {...doc} {...actions} />
      )}
    </AppLayout>
  );
}
