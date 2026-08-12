import type { User } from '../types';

// ============================================================================
// Gate de visibilidad del módulo Roadmap Zerion.
// El dueño es Martín. Su identificador visible en el CRM es "117mgd" — es el
// NOMBRE de perfil (derivado del email), NO el auth id: los UUID de Supabase
// son hexadecimales (0-9a-f) y "117mgd" contiene 'm'/'g', así que matchear el
// id nunca podría funcionar (bug corregido: se matchea nombre/email).
// Fallback por email admin@zerionstudio.com = modo mock (QA local sin Supabase).
// Los empleados NUNCA lo ven.
// ============================================================================
export function isRoadmapOwner(u: User | null | undefined): boolean {
  if (!u || u.role !== 'admin') return false;
  const marker = '117mgd';
  return (
    u.name.toLowerCase().includes(marker) ||
    u.email.toLowerCase().includes(marker) ||
    u.email === 'admin@zerionstudio.com'
  );
}
