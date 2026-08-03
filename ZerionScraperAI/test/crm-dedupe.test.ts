import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllPages, isCrmDuplicate, type CrmDedupeKeys } from '../src/integrations/crm/push.js';

function keys(partial: Partial<CrmDedupeKeys> = {}): CrmDedupeKeys {
  return {
    phones: new Set(),
    placeIds: new Set(),
    discoveryIds: new Set(),
    discoveryPhones: new Set(),
    ...partial,
  };
}

test('isCrmDuplicate: place_id already a prospecto → duplicate', () => {
  const k = keys({ placeIds: new Set(['pid-1']) });
  assert.equal(isCrmDuplicate('pid-1', '17135550101', k), true);
});

test('isCrmDuplicate: place_id in the Lead Finder inbox → duplicate', () => {
  const k = keys({ discoveryIds: new Set(['pid-2']) });
  assert.equal(isCrmDuplicate('pid-2', null, k), true);
});

test('isCrmDuplicate: phone already a prospecto → duplicate', () => {
  const k = keys({ phones: new Set(['17135550101']) });
  assert.equal(isCrmDuplicate(null, '17135550101', k), true);
});

test('isCrmDuplicate: phone in the Lead Finder inbox → duplicate', () => {
  const k = keys({ discoveryPhones: new Set(['17135550101']) });
  assert.equal(isCrmDuplicate(null, '17135550101', k), true);
});

test('isCrmDuplicate: fresh lead (no place/phone match) → not duplicate', () => {
  const k = keys({ placeIds: new Set(['pid-x']), phones: new Set(['19999999999']) });
  assert.equal(isCrmDuplicate('pid-new', '17135550101', k), false);
  // No placeId and no phone → never a duplicate by these keys (belt and
  // suspenders: the caller still refuses phone-less leads on other grounds).
  assert.equal(isCrmDuplicate(null, null, k), false);
});

test('fetchAllPages pages past the 1000-row PostgREST cap', async () => {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < 2050; i++) rows.push({ phone: `+1 ${i}` });

  let calls = 0;
  const fakeCrm = {
    from() {
      return {
        select() {
          return {
            range(from: number, to: number) {
              calls++;
              const page = rows.slice(from, to + 1);
              return Promise.resolve({ data: page, error: null });
            },
          };
        },
      };
    },
  };

  const all = await fetchAllPages(fakeCrm as unknown as SupabaseClient, 'leads', 'phone');
  assert.equal(all.length, 2050);
  assert.equal(calls, 3); // 1000 + 1000 + 50
});
