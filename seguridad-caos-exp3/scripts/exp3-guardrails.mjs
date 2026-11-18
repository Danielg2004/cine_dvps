#!/usr/bin/env node
/**
 * Guardarraíles: ningún comando de mutación puede apuntar a cine-caos.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const ALLOWED_NAMESPACE = 'cine-seguridad-exp3';
export const FORBIDDEN_NAMESPACE = 'cine-caos';

const FORBIDDEN_MUTATION = [
  /\bkubectl\b[^\n]*\s-n\s+cine-caos\b/i,
  /\bkubectl\b[^\n]*\s--namespace[= ]+cine-caos\b/i,
  /\bkubectl\b[^\n]*\sapply\b[^\n]*cine-caos\b/i,
  /\bkubectl\b[^\n]*\s(patch|delete|scale|rollout|create)\b[^\n]*cine-caos\b/i,
];

/**
 * @param {string} text
 * @returns {{ ok: boolean, hits: string[] }}
 */
export function assertNoCineCaosMutation(text) {
  const hits = [];
  for (const re of FORBIDDEN_MUTATION) {
    if (re.test(text)) hits.push(String(re));
  }
  return { ok: hits.length === 0, hits };
}

/**
 * @param {string[]} argv
 */
export function assertArgvTargetsOnlyLab(argv) {
  const joined = argv.join(' ');
  if (/\bcine-caos\b/.test(joined) && /\b(apply|patch|delete|scale|rollout|create)\b/.test(joined)) {
    throw Object.assign(new Error('Guardrail: prohibido mutar cine-caos'), { code: 'EXP3_GUARD_CINE_CAOS' });
  }
  if (/\b(apply|patch|delete|scale|rollout)\b/.test(joined)) {
    if (!joined.includes(ALLOWED_NAMESPACE)) {
      throw Object.assign(
        new Error('Guardrail: mutaciones deben acotarse a cine-seguridad-exp3'),
        { code: 'EXP3_GUARD_NAMESPACE' },
      );
    }
  }
}

/**
 * @param {string} rootAbs
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isAbortRequested(rootAbs, env = process.env) {
  if (env.CINE_TELEMETRY_CHAOS_ABORT === '1' || env.CINE_TELEMETRY_CHAOS_ABORT === 'true') {
    return {
      abort: true,
      source: 'env:CINE_TELEMETRY_CHAOS_ABORT',
      abortRequestedAtUtc: new Date().toISOString(),
    };
  }
  const abortFile = join(rootAbs, 'controls', 'ABORT');
  if (existsSync(abortFile)) {
    return {
      abort: true,
      source: 'file:controls/ABORT',
      abortRequestedAtUtc: new Date().toISOString(),
    };
  }
  return { abort: false, source: null, abortRequestedAtUtc: null };
}
