#!/usr/bin/env node
/**
 * Asistente de análisis de alertas — lab aislado (NO forma parte del runtime Cine API).
 * Sin herramientas de infra; sin permisos GCP/K8s/SQL/OS.
 *
 * Uso:
 *   CINE_AI_PROVIDER=ollama node seguridad-caos-exp3/ai-assistant/assistant.mjs \
 *     --round r1 --event fixtures/benign-alert.json
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildChatMessages } from './prompt-builder.mjs';
import { completeChat } from './providers.mjs';
import { extractJsonObject, validateAnalysisAgainstEvidence } from './output-validator.mjs';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * @param {'r0' | 'r1'} round
 */
export function loadPolicy(round) {
  const path = join(here, 'config', `assistant-policy.${round}.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Analiza un evento sintético. Requiere proveedor LLM real (ollama|openai) salvo fixture en tests.
 *
 * @param {object} event
 * @param {{
 *   round?: 'r0' | 'r1',
 *   provider?: string,
 *   model?: string,
 *   fixtureReply?: string,
 *   validateOutput?: boolean,
 * }} [options]
 */
export async function analyzeSecurityEvent(event, options = {}) {
  const round = options.round === 'r0' ? 'r0' : 'r1';
  const policy = loadPolicy(round);
  const messages = buildChatMessages(event, round, policy);

  // Superficie sin herramientas: este módulo no importa child_process ni SDKs cloud.
  const completion = await completeChat(messages, {
    provider: options.provider,
    model: options.model,
    fixtureReply: options.fixtureReply,
  });

  let parsed;
  let parseError = null;
  try {
    parsed = extractJsonObject(completion.content);
  } catch (err) {
    parseError = err instanceof Error ? err.message : String(err);
    parsed = null;
  }

  const shouldValidate = options.validateOutput ?? policy.validateOutput === true;
  let validation = null;
  if (parsed && shouldValidate) {
    validation = validateAnalysisAgainstEvidence(parsed, event, policy);
  } else if (parsed && !shouldValidate) {
    validation = {
      ok: true,
      errors: [],
      warnings: ['validation_skipped_round_policy'],
      normalized: parsed,
    };
  }

  return {
    round,
    policyId: policy.id,
    provider: completion.provider,
    model: completion.model,
    simulated: completion.simulated === true,
    messagesMeta: {
      systemChars: messages[0].content.length,
      userChars: messages[1].content.length,
      untrustedDelimited: round === 'r1',
    },
    rawModelText: completion.content,
    parseError,
    analysis: parsed,
    validation,
    // Contrato explícito: nunca hay side-effects operativos
    sideEffects: {
      infraCalls: [],
      automaticActionsExecuted: false,
      humanConfirmationRequired: validation?.normalized?.requiresHumanConfirmation === true
        || (Array.isArray(parsed?.recommendedActions) && parsed.recommendedActions.length > 0),
    },
  };
}

function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      out[argv[i].slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const round = args.round === 'r0' ? 'r0' : 'r1';
  if (!args.event) {
    console.error('Uso: --event <file.json> [--round r0|r1] [--out file.json]');
    process.exit(2);
  }
  const eventPath = resolve(args.event);
  if (!existsSync(eventPath)) {
    console.error(`Evento no encontrado: ${eventPath}`);
    process.exit(2);
  }
  const event = JSON.parse(readFileSync(eventPath, 'utf8'));
  try {
    const result = await analyzeSecurityEvent(event, { round });
    const text = `${JSON.stringify(result, null, 2)}\n`;
    if (args.out) writeFileSync(resolve(args.out), text, 'utf8');
    console.log(text);
    process.exit(result.parseError || (result.validation && !result.validation.ok) ? 1 : 0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err && typeof err === 'object' && 'code' in err ? err.code : 'AI_ERROR';
    console.error(JSON.stringify({ ok: false, code, error: message }));
    process.exit(2);
  }
}

const isDirect = Boolean(
  process.argv[1] && /ai-assistant[/\\]assistant\.mjs$/.test(process.argv[1]),
);

if (isDirect) {
  main();
}
