/**
 * Gate de emisión — leído en cada heartbeat.
 * Prioridad: containment (fuerza ON) → flags de volumen → env.
 * Diseñado para inyección parcial SIN reiniciar el pod (identidad estable).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @param {string} filePath
 * @param {string} [envFallback]
 */
export function containmentActive(filePath, envFallback = 'false') {
  try {
    if (filePath && existsSync(filePath)) {
      const v = readFileSync(filePath, 'utf8').trim().toLowerCase();
      if (v === 'true' || v === '1') return true;
    }
  } catch {
    /* ignore */
  }
  const e = String(envFallback || 'false').toLowerCase();
  return e === 'true' || e === '1';
}

/**
 * @param {string | null | undefined} dir
 * @param {string} key
 * @param {string} fallback
 */
export function readFlag(dir, key, fallback) {
  if (!dir) return fallback;
  const p = join(dir, key);
  try {
    if (existsSync(p)) return readFileSync(p, 'utf8').trim();
  } catch {
    /* ignore */
  }
  return fallback;
}

/**
 * @param {{
 *   containmentFile?: string,
 *   containmentEnv?: string,
 *   emitFlagsDir?: string | null,
 *   telemetryEmitEnabledEnv?: string,
 *   otelMetricsExporterEnv?: string,
 * }} opts
 */
export function isEmitEnabled(opts = {}) {
  if (
    containmentActive(
      opts.containmentFile || '/containment/CONTAINMENT_ACTIVE',
      opts.containmentEnv || 'false',
    )
  ) {
    return { enabled: true, reason: 'containment' };
  }

  const emitRaw = readFlag(
    opts.emitFlagsDir,
    'TELEMETRY_EMIT_ENABLED',
    opts.telemetryEmitEnabledEnv ?? 'true',
  );
  const metricsRaw = readFlag(
    opts.emitFlagsDir,
    'OTEL_METRICS_EXPORTER',
    opts.otelMetricsExporterEnv ?? 'otlp',
  );
  const emit = String(emitRaw).toLowerCase();
  const metrics = String(metricsRaw).toLowerCase();
  const enabled = (emit === 'true' || emit === '1') && metrics !== 'none';
  const source = opts.emitFlagsDir ? 'volume' : 'env';
  return {
    enabled,
    reason: enabled ? `emit_ok:${source}` : `emit_disabled:${source}`,
    emit,
    metrics,
    source,
  };
}
