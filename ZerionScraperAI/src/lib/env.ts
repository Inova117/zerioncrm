import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  DB_PATH: z.string().default('./data/leads.db'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  LEAD_SOURCE: z.enum(['apify', 'fixture']).default('apify'),
  APIFY_TOKEN: z.string().optional(),
  FIXTURE_PATH: z.string().default('./test/fixtures/leads.sample.json'),
  SERPER_API_KEY: z.string().optional(),
  REOON_API_KEY: z.string().optional(),
  // LLM: DeepSeek vía OpenRouter (formato OpenAI-compatible).
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default('deepseek/deepseek-v4-flash-0731'),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  INSTANTLY_API_KEY: z.string().optional(),

  // --- Zerion CRM integration (leads flow into the CRM as prospectos) --------
  // The CRM's Supabase project. The service_role key runs server-side ONLY
  // (here in the CLI) — never ship it to a browser. See README "CRM".
  CRM_SUPABASE_URL: z.string().url().optional(),
  CRM_SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  // Email of the CRM user (Staff) who receives the scraped leads for cold calling.
  CRM_ASSIGN_TO_EMAIL: z.string().email().optional(),
  // Auto-push after every `run` when the CRM is configured. Set 'false' to opt out.
  CRM_AUTOPUSH: z.enum(['true', 'false']).default('true'),
});

export const env = EnvSchema.parse(process.env);

/** Throws a clear error when a stage needs a secret that is not configured. */
export function requireEnv<K extends keyof typeof env>(key: K): NonNullable<(typeof env)[K]> {
  const value = env[key];
  if (value === undefined || value === '') {
    throw new Error(`Missing required env var ${String(key)} — add it to .env (see .env.example)`);
  }
  return value as NonNullable<(typeof env)[K]>;
}
