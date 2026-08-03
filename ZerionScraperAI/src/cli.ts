import { Command } from 'commander';
import { desc, eq, sql } from 'drizzle-orm';
import { getDb, migrateDb } from './db/index.js';
import { costs, leads, profiles, runs, type HasWebsiteFilter } from './db/schema.js';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { isCrmConfigured } from './integrations/crm/client.js';
import { pushLeadsToCrm } from './integrations/crm/push.js';
import { createLeadSource } from './pipeline/sources/index.js';
import { runPipeline } from './pipeline/run.js';

const program = new Command()
  .name('lead-machine')
  .description('ZerionStudio Lead Machine — pipeline CLI');

program
  .command('migrate')
  .description('Apply database migrations')
  .action(() => {
    migrateDb(getDb());
    logger.info('migrations applied');
  });

program
  .command('profile:create')
  .description('Create a campaign profile (F1)')
  .requiredOption('--name <name>', 'unique profile name')
  .requiredOption('--industry <industry>', 'e.g. "general contractor"')
  .requiredOption('--geo <geo...>', 'one or more geos, e.g. --geo "Houston, TX"')
  .option('--language <lang>', 'es | en | auto', 'auto')
  .option('--leads-per-day <n>', 'daily NEW leads target', '50')
  .option('--rating-min <n>')
  .option('--rating-max <n>')
  .option('--reviews-min <n>')
  .option('--reviews-max <n>')
  .option('--has-website <v>', 'yes | no | any', 'any')
  .action((opts) => {
    const db = getDb();
    const [row] = db
      .insert(profiles)
      .values({
        name: opts.name,
        industry: opts.industry,
        geos: opts.geo,
        language: opts.language,
        leadsPerDay: Number(opts.leadsPerDay),
        filters: {
          ...(opts.ratingMin ? { ratingMin: Number(opts.ratingMin) } : {}),
          ...(opts.ratingMax ? { ratingMax: Number(opts.ratingMax) } : {}),
          ...(opts.reviewsMin ? { reviewCountMin: Number(opts.reviewsMin) } : {}),
          ...(opts.reviewsMax ? { reviewCountMax: Number(opts.reviewsMax) } : {}),
          hasWebsite: opts.hasWebsite as HasWebsiteFilter,
        },
      })
      .returning()
      .all();
    logger.info({ profile: row }, 'profile created');
  });

program
  .command('profile:list')
  .description('List campaign profiles')
  .action(() => {
    const rows = getDb().select().from(profiles).all();
    for (const p of rows) {
      console.log(
        `#${p.id} ${p.name} — ${p.industry} @ ${p.geos.join(' | ')} — ${p.leadsPerDay}/day — lang=${p.language} — ${p.active ? 'active' : 'inactive'}`,
      );
    }
    if (!rows.length) console.log('(no profiles yet — use profile:create)');
  });

program
  .command('run')
  .description('Run the daily pipeline (F2+)')
  .option('--profile <name>', 'run a single profile by name')
  .option('--all', 'run all active profiles')
  .action(async (opts) => {
    const db = getDb();
    const source = createLeadSource();

    const targets = opts.all
      ? db.select().from(profiles).where(eq(profiles.active, true)).all()
      : opts.profile
        ? db.select().from(profiles).where(eq(profiles.name, opts.profile)).all()
        : [];

    if (!targets.length) {
      logger.error('no matching profiles — pass --profile <name> or --all');
      process.exitCode = 1;
      return;
    }

    for (const profile of targets) {
      logger.info({ profile: profile.name, source: source.name }, 'pipeline start');
      const summary = await runPipeline(db, source, profile);
      logger.info(summary, 'pipeline done');

      // The leads "fall into" the CRM automatically after each run so René can
      // start cold-calling immediately. Failure here never fails the run.
      if (isCrmConfigured() && env.CRM_AUTOPUSH !== 'false') {
        try {
          const crmSummary = await pushLeadsToCrm(db, profile);
          logger.info(crmSummary, 'crm push done');
        } catch (error) {
          logger.error({ profile: profile.name, error: String(error) }, 'crm push failed');
        }
      }
    }
  });

program
  .command('crm:push')
  .description('Empuja los leads del scraper al CRM (Supabase) como prospectos')
  .option('--profile <name>', 'un solo perfil por nombre')
  .option('--all', 'todos los perfiles activos')
  .action(async (opts) => {
    if (!isCrmConfigured()) {
      logger.error(
        'CRM no configurado — define CRM_SUPABASE_URL, CRM_SUPABASE_SERVICE_ROLE_KEY y CRM_ASSIGN_TO_EMAIL en .env',
      );
      process.exitCode = 1;
      return;
    }

    const db = getDb();
    const targets = opts.all
      ? db.select().from(profiles).where(eq(profiles.active, true)).all()
      : opts.profile
        ? db.select().from(profiles).where(eq(profiles.name, opts.profile)).all()
        : [];

    if (!targets.length) {
      logger.error('no matching profiles — pass --profile <name> or --all');
      process.exitCode = 1;
      return;
    }

    for (const profile of targets) {
      const summary = await pushLeadsToCrm(db, profile);
      logger.info(summary, 'crm push done');
    }
  });

program
  .command('stats')
  .description('Quick funnel + cost stats')
  .action(() => {
    const db = getDb();
    const byStatus = db
      .select({ status: leads.status, n: sql<number>`count(*)` })
      .from(leads)
      .groupBy(leads.status)
      .all();
    const totalCost = db
      .select({ usd: sql<number>`coalesce(sum(${costs.amountUsd}), 0)` })
      .from(costs)
      .get();
    const lastRuns = db.select().from(runs).orderBy(desc(runs.id)).limit(5).all();

    console.log('Leads by status:');
    for (const r of byStatus) console.log(`  ${r.status}: ${r.n}`);
    console.log(`Total recorded cost: $${(totalCost?.usd ?? 0).toFixed(4)}`);
    console.log('Last runs:');
    for (const r of lastRuns) {
      console.log(
        `  run #${r.id} profile=${r.profileId} ${r.status} fetched=${r.leadsFetched} new=${r.leadsNew}`,
      );
    }
  });

program.parseAsync().catch((error) => {
  logger.error(String(error));
  process.exitCode = 1;
});
