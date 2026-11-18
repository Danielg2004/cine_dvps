/**
 * Extrae muestras cine.telemetry.heartbeat desde cuerpos OTLP (JSON).
 * Compatible con ExportMetricsServiceRequest / ResourceMetrics serializados por
 * @opentelemetry/exporter-metrics-otlp-http (Content-Type: application/json).
 */

import { HEARTBEAT_SIGNAL } from '../detections/telemetry-silence-detector.mjs';

/**
 * @param {unknown} value
 * @returns {string | undefined}
 */
function attrString(value) {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const v = /** @type {Record<string, unknown>} */ (value);
    if (typeof v.stringValue === 'string') return v.stringValue;
    if (typeof v.value === 'string') return v.value;
  }
  return undefined;
}

/**
 * @param {unknown[]} attrs
 * @returns {Record<string, string>}
 */
function attrsToMap(attrs) {
  /** @type {Record<string, string>} */
  const out = {};
  if (!Array.isArray(attrs)) return out;
  for (const a of attrs) {
    if (!a || typeof a !== 'object') continue;
    const row = /** @type {Record<string, unknown>} */ (a);
    const key = typeof row.key === 'string' ? row.key : undefined;
    if (!key) continue;
    const s = attrString(row.value);
    if (s !== undefined) out[key] = s;
  }
  return out;
}

/**
 * @param {unknown} nano
 * @returns {string}
 */
function nanoToIso(nano) {
  if (nano == null) return new Date().toISOString();
  let n;
  if (typeof nano === 'string') n = Number(nano);
  else if (typeof nano === 'number') n = nano;
  else if (typeof nano === 'object' && nano && 'low' in /** @type {object} */ (nano)) {
    // Fixed64 raro — fallback now
    return new Date().toISOString();
  } else {
    return new Date().toISOString();
  }
  if (!Number.isFinite(n) || n <= 0) return new Date().toISOString();
  return new Date(n / 1e6).toISOString();
}

/**
 * @param {unknown} body
 * @returns {object[]}
 */
export function extractHeartbeatSamplesFromOtlpJson(body) {
  /** @type {object[]} */
  const samples = [];
  if (!body || typeof body !== 'object') return samples;

  const root = /** @type {Record<string, unknown>} */ (body);
  const resourceMetrics = Array.isArray(root.resourceMetrics)
    ? root.resourceMetrics
    : Array.isArray(root.resource_metrics)
      ? root.resource_metrics
      : [];

  for (const rm of resourceMetrics) {
    if (!rm || typeof rm !== 'object') continue;
    const rmObj = /** @type {Record<string, unknown>} */ (rm);
    const resource = rmObj.resource && typeof rmObj.resource === 'object'
      ? /** @type {Record<string, unknown>} */ (rmObj.resource)
      : {};
    const resourceAttrs = attrsToMap(
      /** @type {unknown[]} */ (resource.attributes || []),
    );

    const scopeMetrics = Array.isArray(rmObj.scopeMetrics)
      ? rmObj.scopeMetrics
      : Array.isArray(rmObj.scope_metrics)
        ? rmObj.scope_metrics
        : [];

    for (const sm of scopeMetrics) {
      if (!sm || typeof sm !== 'object') continue;
      const metrics = /** @type {Record<string, unknown>} */ (sm).metrics;
      if (!Array.isArray(metrics)) continue;

      for (const metric of metrics) {
        if (!metric || typeof metric !== 'object') continue;
        const m = /** @type {Record<string, unknown>} */ (metric);
        if (m.name !== HEARTBEAT_SIGNAL) continue;

        const points = [];
        if (m.sum && typeof m.sum === 'object') {
          const sum = /** @type {Record<string, unknown>} */ (m.sum);
          if (Array.isArray(sum.dataPoints)) points.push(...sum.dataPoints);
          if (Array.isArray(sum.data_points)) points.push(...sum.data_points);
        }
        if (m.gauge && typeof m.gauge === 'object') {
          const gauge = /** @type {Record<string, unknown>} */ (m.gauge);
          if (Array.isArray(gauge.dataPoints)) points.push(...gauge.dataPoints);
          if (Array.isArray(gauge.data_points)) points.push(...gauge.data_points);
        }

        for (const dp of points) {
          if (!dp || typeof dp !== 'object') continue;
          const point = /** @type {Record<string, unknown>} */ (dp);
          const pointAttrs = attrsToMap(
            /** @type {unknown[]} */ (point.attributes || []),
          );
          const merged = { ...resourceAttrs, ...pointAttrs };
          const serviceName = merged['service.name'] || 'cine-api';
          const instanceId = merged['service.instance.id'] || 'unknown-instance';
          const environment = merged['deployment.environment'] || 'unknown';
          const observedAtUtc = nanoToIso(
            point.timeUnixNano ?? point.time_unix_nano,
          );
          let counterValue;
          if (typeof point.asInt === 'number') counterValue = point.asInt;
          else if (typeof point.asInt === 'string') counterValue = Number(point.asInt);
          else if (typeof point.asDouble === 'number') counterValue = point.asDouble;

          samples.push({
            observedAtUtc,
            serviceName,
            signal: HEARTBEAT_SIGNAL,
            heartbeatOk: true,
            instanceId,
            environment,
            counterValue: Number.isFinite(counterValue) ? counterValue : undefined,
            source: 'otlp-http-json',
          });
        }
      }
    }
  }

  return samples;
}
