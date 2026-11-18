#!/usr/bin/env node
/**
 * Contención real acotada a cine-seguridad-exp3.
 *
 * Local (--mode=local, default): escribe estado de contención en evidencias + flag en memoria vía archivo lab.
 * GKE (--mode=gke): documenta/ejecuta apply del overlay contain SOLO si EXP3_ALLOW_GKE_MUTATION=1.
 *
 * Nunca toca cine-caos.
 *
 * Uso:
 *   node seguridad-caos-exp3/scripts/exp3-containment.mjs --mode=local
 *   EXP3_ALLOW_GKE_MUTATION=1 node ... --mode=gke   # futuro autorizado
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ALLOWED_NAMESPACE, assertArgvTargetsOnlyLab, isAbortRequested } from './exp3-guardrails.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const statePath = join(root, 'evidencias-locales', 'exp3-containment-state.json');

function parseMode(argv) {
  const m = argv.find((a) => a.startsWith('--mode='))?.split('=')[1]
    || (argv.includes('--mode') ? argv[argv.indexOf('--mode') + 1] : 'local');
  return m === 'gke' ? 'gke' : 'local';
}

/**
 * Acción observable de contención local: CONTAINMENT_ACTIVE=true en estado lab.
 * @returns {{ abortRequestedAtUtc: string|null, containedAtUtc: string, source: string, namespace: string }}
 */
export function activateLocalContainment(options = {}) {
  const abort = isAbortRequested(root, options.env || process.env);
  mkdirSync(dirname(statePath), { recursive: true });
  const containedAtUtc = options.containedAtUtc || new Date().toISOString();
  const state = {
    namespace: ALLOWED_NAMESPACE,
    containmentActive: true,
    abortRequestedAtUtc: options.abortRequestedAtUtc || abort.abortRequestedAtUtc,
    abortSource: abort.source,
    containedAtUtc,
    action: 'set_CONTAINMENT_ACTIVE_true',
    note: 'Detiene silencio adverso forzando emisión; restore_sec se mide cuando detector vuelve OK / overlay restore',
    cloudTouched: false,
    timelineMode: options.containedAtUtc ? 'synthetic_or_provided' : 'wall_clock',
  };
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  // Flag archivo para runners locales que montan containment
  const containDir = join(root, 'evidencias-locales', 'containment-flag');
  mkdirSync(containDir, { recursive: true });
  writeFileSync(join(containDir, 'CONTAINMENT_ACTIVE'), 'true\n', 'utf8');
  return state;
}

export function clearLocalContainment() {
  const contained = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : null;
  const clearedAtUtc = new Date().toISOString();
  const state = {
    namespace: ALLOWED_NAMESPACE,
    containmentActive: false,
    previous: contained,
    clearedAtUtc,
    action: 'set_CONTAINMENT_ACTIVE_false',
    cloudTouched: false,
  };
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  const containDir = join(root, 'evidencias-locales', 'containment-flag');
  mkdirSync(containDir, { recursive: true });
  writeFileSync(join(containDir, 'CONTAINMENT_ACTIVE'), 'false\n', 'utf8');
  return state;
}

function activateGkeContainment() {
  if (process.env.EXP3_ALLOW_GKE_MUTATION !== '1') {
    throw Object.assign(
      new Error('GKE containment bloqueado: defina EXP3_ALLOW_GKE_MUTATION=1 tras autorización'),
      { code: 'EXP3_GKE_BLOCKED' },
    );
  }
  const args = ['apply', '-k', join(root, 'gke-lab/overlays/contain'), '-n', ALLOWED_NAMESPACE];
  assertArgvTargetsOnlyLab(['kubectl', ...args]);
  const abort = isAbortRequested(root);
  const started = new Date().toISOString();
  const r = spawnSync('kubectl', args, { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`kubectl contain failed: ${r.stderr || r.stdout}`);
  }
  const containedAtUtc = new Date().toISOString();
  const state = {
    namespace: ALLOWED_NAMESPACE,
    containmentActive: true,
    abortRequestedAtUtc: abort.abortRequestedAtUtc,
    abortSource: abort.source,
    containApplyStartedAtUtc: started,
    containedAtUtc,
    action: 'kubectl_apply_overlays_contain',
    cloudTouched: true,
    stdoutTail: (r.stdout || '').slice(0, 500),
  };
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  return state;
}

function main() {
  const mode = parseMode(process.argv.slice(2));
  const force = process.argv.includes('--force');
  const abort = isAbortRequested(root);
  if (!abort.abort && !force) {
    console.error(JSON.stringify({
      ok: false,
      error: 'ABORT no activo (controls/ABORT o CINE_TELEMETRY_CHAOS_ABORT=1). Use --force solo en tests.',
    }));
    process.exit(2);
  }
  const state = mode === 'gke' ? activateGkeContainment() : activateLocalContainment();
  console.log(JSON.stringify({ ok: true, mode, ...state }, null, 2));
}

const isDirect = process.argv[1] && /exp3-containment\.mjs$/.test(process.argv[1].replace(/\\/g, '/'));
if (isDirect) {
  try {
    main();
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
    process.exit(2);
  }
}
