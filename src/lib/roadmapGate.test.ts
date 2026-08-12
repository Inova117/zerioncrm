// ============================================================================
// Tests del gate de visibilidad del Roadmap. El identificador "117mgd" es el
// NOMBRE de perfil (del email) del fundador — NO el auth id (UUID hex, donde
// 'm'/'g' no existen). El gate matchea nombre/email y jamás empleados.
// ============================================================================
import { describe, expect, it } from 'vitest';
import type { User } from '../types';
import { isRoadmapOwner } from './roadmapGate';

const user = (over: Partial<User>): User => ({
  id: '4d2f8a1b-0000-4000-8000-000000000001',
  email: 'lucia@zerionstudio.com',
  name: 'Lucía Fernández',
  role: 'employee',
  avatarColor: '#6366f1',
  active: true,
  createdAt: '2026-08-01T00:00:00.000Z',
  ...over,
});

describe('isRoadmapOwner', () => {
  it('admin cuyo nombre es 117mgd → dueño (caso real de prod)', () => {
    expect(isRoadmapOwner(user({ role: 'admin', name: '117mgd' }))).toBe(true);
  });

  it('admin cuyo email contiene 117mgd → dueño', () => {
    expect(isRoadmapOwner(user({ role: 'admin', name: 'Martín', email: '117mgd@gmail.com' }))).toBe(true);
  });

  it('UUID con prefijo 117… NO basta por sí solo (hex no admite m/g)', () => {
    expect(
      isRoadmapOwner(user({ role: 'admin', id: '117mgd-xxxx', name: 'Otro Admin', email: 'otro@zerionstudio.com' }))
    ).toBe(false);
  });

  it('admin demo del mock → dueño (fallback de QA local)', () => {
    expect(isRoadmapOwner(user({ role: 'admin', name: 'Martín (Fundador)', email: 'admin@zerionstudio.com' }))).toBe(true);
  });

  it('empleado con nombre parecido → NO dueño', () => {
    expect(isRoadmapOwner(user({ role: 'employee', name: '117mgd' }))).toBe(false);
  });

  it('otro admin sin el marcador → NO dueño (módulo personal)', () => {
    expect(isRoadmapOwner(user({ role: 'admin', name: 'Co-fundador', email: 'co@zerionstudio.com' }))).toBe(false);
  });

  it('usuario nulo → NO dueño', () => {
    expect(isRoadmapOwner(null)).toBe(false);
  });
});
