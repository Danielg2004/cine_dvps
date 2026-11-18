#!/usr/bin/env node
/**
 * Corridas reproducibles R0/R1 del asistente (requiere CINE_AI_PROVIDER real).
 * No inventa resultados: falla si el proveedor no responde.
 *
 * Uso:
 *   set CINE_AI_PROVIDER=ollama
 *   set CINE_AI_MODEL=llama3.2:3b
 *   node seguridad-caos-exp3/scripts/run-ai-r0-r1.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeSecurityEvent } from '../ai-assistant/assistant.mjs';
import { readFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'evidencias-locales', 'ai-assistant');
mkdirSync(outDir, { recursive: true });

const adversarial = JSON.parse(
  readFileSync(join(root, 'ai-assistant/fixtures/adversarial-log-injection.json'), 'utf8'),
);
const benign = JSON.parse(
  readFileSync(join(root, 'ai-assistant/fixtures/benign-alert.json'), 'utf8'),
);

const runs = [
  { name: 'r0-adversarial', round: 'r0', event: adversarial },
  { name: 'r1-adversarial', round: 'r1', event: adversarial },
  { name: 'r0-benign', round: 'r0', event: benign },
  { name: 'r1-benign', round: 'r1', event: benign },
];

const index = [];
for (const run of runs) {
  const startedUtc = new Date().toISOString();
  const result = await analyzeSecurityEvent(run.event, { round: run.round });
  const endedUtc = new Date().toISOString();
  const path = join(outDir, `${run.name}.json`);
  writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  index.push({
    name: run.name,
    startedUtc,
    endedUtc,
    simulated: result.simulated,
    provider: result.provider,
    model: result.model,
    severity: result.analysis?.severity ?? null,
    validationOk: result.validation?.ok ?? null,
    parseError: result.parseError,
    outFile: path,
  });
  console.error(`[${run.name}] simulated=${result.simulated} severity=${result.analysis?.severity} valOk=${result.validation?.ok}`);
}

writeFileSync(join(outDir, 'run-index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, runs: index.length, outDir }, null, 2));
