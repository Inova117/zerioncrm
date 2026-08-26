// ============================================================================
// Local mock database (localStorage).
// ----------------------------------------------------------------------------
// This is the ONLY place that touches persistence in the mock phase. Every
// service module reads/writes through here. Each "table" maps to a future
// Supabase table of the same name; swapping to Supabase means replacing the
// service functions, not the components.
// ============================================================================

import type { User, Credential, Lead, Contact, Comment, Task, Discovery, SearchSummary, ProspectingCampaign, DecisionRecord, RoadmapDay, RoadmapActivity, RoadmapClient, CashMove, RoadmapMeta, Prospecto } from '../types';
import {
  seedUsers,
  seedCredentials,
  seedLeads,
  seedContacts,
  seedComments,
  seedTasks,
  seedRoadmapDays,
  seedRoadmapActivities,
  seedRoadmapMeta,
  seedProspectos,
} from '../data/seed';

const NS = 'zerioncrm';
const VERSION = 1;

export interface DBShape {
  users: User[];
  credentials: Credential[];
  leads: Lead[];
  contacts: Contact[];
  comments: Comment[];
  tasks: Task[];
  discoveries: Discovery[];
  searches: SearchSummary[];
  campaigns: ProspectingCampaign[];
  decisions: DecisionRecord[];
  roadmapDays: RoadmapDay[];
  roadmapActivities: RoadmapActivity[];
  roadmapClients: RoadmapClient[];
  roadmapCash: CashMove[];
  roadmapMeta: RoadmapMeta[];
  /* Minero de Prospectos del fundador (personal, owner-only). */
  prospectos: Prospecto[];
  session: string | null; // logged-in user id
}

type TableKey = Exclude<keyof DBShape, 'session'>;

const key = (name: string) => `${NS}:v${VERSION}:${name}`;

function read<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key(name));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(name: string, value: T): void {
  try {
    localStorage.setItem(key(name), JSON.stringify(value));
  } catch (err) {
    // Symmetric with read()'s try/catch: don't let a quota/serialization error
    // crash a mutation. Surface it for debugging without throwing. (bug #24)
    console.error(`[db] no se pudo guardar "${name}":`, err);
  }
}

/** Seed localStorage once. Safe to call on every app boot. */
export function ensureSeeded(): void {
  if (localStorage.getItem(key('seeded'))) return;
  write('users', seedUsers);
  write('credentials', seedCredentials);
  write('leads', seedLeads);
  write('contacts', seedContacts);
  write('comments', seedComments);
  write('tasks', seedTasks);
  write('roadmapDays', seedRoadmapDays);
  write('roadmapActivities', seedRoadmapActivities);
  write('roadmapClients', []);
  write('roadmapCash', []);
  write('roadmapMeta', seedRoadmapMeta);
  write('prospectos', seedProspectos);
  localStorage.setItem(key('seeded'), '1');
}

/** Wipe everything and re-seed (used by the "restablecer datos" action). */
export function resetDB(): void {
  ['users', 'credentials', 'leads', 'contacts', 'comments', 'tasks', 'discoveries', 'searches', 'campaigns', 'decisions', 'prospectos', 'session', 'seeded'].forEach(
    (n) => localStorage.removeItem(key(n))
  );
  ['roadmapDays', 'roadmapActivities', 'roadmapClients', 'roadmapCash', 'roadmapMeta'].forEach((n) =>
    localStorage.removeItem(key(n))
  );
  ensureSeeded();
}

// Simulate a little network latency so loading states are visible & realistic.
export const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

export const table = {
  get<K extends TableKey>(name: K): DBShape[K] {
    return read(name, [] as unknown as DBShape[K]);
  },
  set<K extends TableKey>(name: K, rows: DBShape[K]): void {
    write(name, rows);
  },
};

export const session = {
  get(): string | null {
    return read<string | null>('session', null);
  },
  set(userId: string | null): void {
    write('session', userId);
  },
};
