import type { User } from '../types';

// ============================================================================
// Gate de visibilidad del módulo Roadmap Zerion.
// El dueño es Martín: su auth id de Supabase empieza con '117mgd'. El fallback
// por email cubre el modo mock (QA local sin Supabase), donde el admin demo es
// admin@zerionstudio.com con id 'usr-admin'. Los empleados NUNCA lo ven.
// ============================================================================
export function isRoadmapOwner(u: User | null | undefined): boolean {
  if (!u || u.role !== 'admin') return false;
  return u.id.startsWith('117mgd') || u.email === 'admin@zerionstudio.com';
}
