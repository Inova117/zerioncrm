// ============================================================================
// useNichePerformance — feedback loop en la app: agarra los leads + las
// encuestas post-llamada del Copilot y computa el rendimiento por nicho
// (tasas Laplace + prioridad). Alimenta el panel de diagnóstico y, en el
// futuro, el decisor diario de prospección.
// ============================================================================
import { useEffect, useState } from 'react';
import { useData } from '../context/DataContext';
import { listRecentCopilotCalls } from '../services/copilotService';
import { nichePerformance } from '../lib/feedback';
import type { NichePerformance } from '../lib/feedback';
import type { CallSurveyAnswers } from '../types';

export function useNichePerformance(): NichePerformance[] {
  const { allLeads } = useData();
  const [perf, setPerf] = useState<NichePerformance[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Las encuestas viven en los records del Copilot (leadId → outcome.survey).
      let surveys: Record<string, CallSurveyAnswers> = {};
      try {
        const calls = await listRecentCopilotCalls(365);
        surveys = {};
        for (const c of calls) {
          if (c.outcome?.survey) surveys[c.leadId] = c.outcome.survey;
        }
      } catch {
        // sin encuestas cargables → feedback solo con etapas (no bloquea)
      }
      if (alive) setPerf(nichePerformance(allLeads, surveys));
    })();
    return () => {
      alive = false;
    };
  }, [allLeads]);

  return perf;
}