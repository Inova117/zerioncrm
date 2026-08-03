# ZerionStudio Lead Machine

Internal daily lead machine: every morning, a fresh batch of enriched, audited,
scored leads for a founder-chosen industry × geo — exportable as an
Instantly-ready CSV with per-lead personalization variables.

**Spec & locked decisions:** see [reports/](reports/) (Spanish) — start with
[00_RESUMEN_EJECUTIVO.md](reports/00_RESUMEN_EJECUTIVO.md). Build plan:
[03_MVP_14_DIAS.md](reports/03_MVP_14_DIAS.md).

## Stack

TypeScript end-to-end: Node + tsx (pipeline CLI), Drizzle ORM + SQLite (data),
Playwright (audits, day 6), Next.js (dashboard, day 11), DeepSeek V4 Flash
(0731) vía OpenRouter (pain mining + personalization, days 8-9), Instantly
(sending — CSV export, API push in v1.1).

## Quickstart

```bash
npm install
cp .env.example .env        # fill in tokens (APIFY_TOKEN etc.)
npm run db:migrate          # or: npx tsx src/cli.ts migrate

# create a campaign profile (F1)
npx tsx src/cli.ts profile:create \
  --name houston-gc --industry "general contractor" \
  --geo "Houston, TX" --language auto --leads-per-day 50

# daily run (F2+) — idempotent, safe to re-run
npx tsx src/cli.ts run --profile houston-gc   # or --all
npx tsx src/cli.ts stats
```

Local testing without spending Apify credits: set `LEAD_SOURCE=fixture` in
`.env` (uses `test/fixtures/leads.sample.json`).

```bash
npm run typecheck
npm test
```

## Zerion CRM integration

The leads generated each run **fall into the [Zerion CRM](../) as prospectos**
(temperature `nuevo`) assigned to a Staff member, ready for cold calling.
It's a one-way push from this scraper's SQLite into the CRM's Supabase — the
two apps stay decoupled.

Configure three env vars (see `.env.example`):

```bash
CRM_SUPABASE_URL=...                 # the CRM's Supabase project URL
CRM_SUPABASE_SERVICE_ROLE_KEY=...    # service_role — SERVER-SIDE ONLY, bypasses RLS
CRM_ASSIGN_TO_EMAIL=rene@zerion...   # a Staff user that already exists in the CRM
```

With those set, `run` **auto-pushes** after each pipeline (disable with
`CRM_AUTOPUSH=false`). You can also push on demand:

```bash
npx tsx src/cli.ts crm:push --profile houston-gc   # or --all
```

What the push does:

- Picks this profile's workable leads (skips `error/disqualified` + email
  terminals) that haven't been pushed yet.
- **Dedupes by phone** against everything already in the CRM.
- Inserts each as a `nuevo` prospecto — `name → company`, `phone`, `websiteUrl
  → website`, `category → industry`, `decisionMakerName → contactName`, and a
  rich `reason` (rating, segment, what-they-do, score) as the call context.
  Source is tagged **"Scraper AI"** and channel encodes the profile + run, so
  the founder can see the leads from each run.
- Logs the result in the local `pushes` table so re-runs never double-insert.

## Layout

```
src/
├── db/            # Drizzle schema (11 tables) + migrations glue
├── lib/           # env (zod), logger (pino), retry, normalize, cost tracking
├── pipeline/
│   ├── run.ts     # orchestrator: per-lead status state machine, graceful errors
│   ├── sources/   # LeadSource interface: apify (prod) / fixture (tests)
│   ├── dedupe.ts  # hard dedupe: place_id + normalized domain + phone
│   └── stages/    # ingest (done) · segment/enrich/audit/score/variables (days 4-9)
├── integrations/ # crm/ — push scraper leads into the Zerion CRM (Supabase)
└── cli.ts         # migrate | profile:create | profile:list | run | crm:push | stats
drizzle/           # generated SQL migrations (committed)
reports/           # phase-1 research & spec (Spanish)
```

## Lead state machine

`new → segmented → enriched → audited → scored → ready → approved → exported/pushed`
(plus `replied/bounced/unsubscribed/disqualified/error`). Stages register in
`LEAD_STAGES` (src/pipeline/run.ts); a lead only moves forward, so re-running
never repeats paid work.

## Non-negotiables encoded in the schema

- `findings` table: every generated personalization claim must reference a
  verified finding (`variables.sourceFindingIds`) — no invented flattery (F10).
- `suppression` table: the exporter always checks it (CAN-SPAM).
- `costs` table: every paid API call records USD per lead/run.
- `reviews` are internal LLM input only — never republished (Google ToS).
