// ============================================================================
// Sincroniza el playbook al servidor.
//
// Antes, el playbook (~58KB) viajaba desde el navegador en CADA request del
// copilot — puro peso muerto de subida antes del primer token. Este script
// genera supabase/functions/copilot/playbook.ts con el texto ya ensamblado,
// para que la Edge Function lo tenga local y el cliente mande solo lo dinámico
// (ficha, transcript, historial, ajustes: ~2-5KB).
//
// Corre solo (npm prebuild) y también a mano: npm run sync:playbook
// Después de cambiar cualquier módulo de src/data/playbook/, hay que
// re-deployar la función: supabase functions deploy copilot
// ============================================================================
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { playbookForPrompt } from '../src/data/salesPlaybook';
import { APERTURA_A_LLM_SPEC, APERTURA_B_LLM_SPEC } from '../src/data/playbook/aperturaSpec';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, 'supabase', 'functions', 'copilot', 'playbook.ts');

const text = playbookForPrompt();
const header = `// ============================================================================
// GENERADO — NO EDITAR A MANO.
// Fuente: src/data/playbook/* → npm run sync:playbook
// Tras regenerar: supabase functions deploy copilot
// ============================================================================
`;
writeFileSync(out, `${header}export const PLAYBOOK: string = ${JSON.stringify(text)};\n`);
console.log(`playbook.ts sincronizado: ${text.length} chars (~${Math.round(text.length / 3.6)} tokens)`);

// Los specs de la apertura A/B (fuente única: src/data/playbook/aperturaSpec.ts)
// también viajan al edge generados — así el briefing del servidor y el del
// cliente jamás divergen.
const aperturaOut = join(root, 'supabase', 'functions', 'copilot', 'aperturaSpec.ts');
writeFileSync(
  aperturaOut,
  `${header}export const APERTURA_A_LLM_SPEC: string = ${JSON.stringify(APERTURA_A_LLM_SPEC)};\nexport const APERTURA_B_LLM_SPEC: string = ${JSON.stringify(APERTURA_B_LLM_SPEC)};\n`
);
console.log('aperturaSpec.ts sincronizado (specs A/B para el briefing del edge)');
