#!/usr/bin/env node
/**
 * Receptor OTLP HTTP local (métricas) — sin cloud.
 *
 * Acepta POST /v1/metrics con application/json (OTLP JSON),
 * el mismo wire protocol que @opentelemetry/exporter-metrics-otlp-http.
 *
 * Uso:
 *   node seguridad-caos-exp3/otlp-local/otlp-http-receiver.mjs [--port 4319] [--out dir]
 *
 * Por defecto escucha 127.0.0.1:0 (puerto efímero) e imprime la URL en stdout como JSON.
 */

import http from 'node:http';
import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { extractHeartbeatSamplesFromOtlpJson } from './otlp-metrics-parser.mjs';
import { createOtlpSampleStore } from './otlp-sample-store.mjs';

/**
 * @param {{
 *   host?: string,
 *   port?: number,
 *   maxAgeSec?: number,
 *   outDir?: string | null,
 * }} [options]
 */
export function createOtlpHttpMetricsReceiver(options = {}) {
  const host = options.host || '127.0.0.1';
  const port = options.port ?? 0;
  const store = createOtlpSampleStore({ maxAgeSec: options.maxAgeSec ?? 120 });
  const outDir = options.outDir ? resolve(options.outDir) : null;
  if (outDir) mkdirSync(outDir, { recursive: true });

  /** @type {import('node:http').Server | null} */
  let server = null;

  function persistSample(sample) {
    if (!outDir) return;
    appendFileSync(join(outDir, 'heartbeat-samples.jsonl'), `${JSON.stringify(sample)}\n`, 'utf8');
  }

  function handleMetricsBody(raw, contentType) {
    store.recordOtlpRequest();
    const ct = (contentType || '').toLowerCase();
    if (!ct.includes('json') && ct.includes('protobuf')) {
      return {
        ok: false,
        status: 415,
        error: 'application/x-protobuf no decodificado en este receptor Node; use OTLP JSON o el Collector (otel-collector-config.yaml)',
      };
    }

    let body;
    try {
      body = JSON.parse(raw.toString('utf8') || '{}');
    } catch {
      return { ok: false, status: 400, error: 'JSON OTLP inválido' };
    }

    const extracted = extractHeartbeatSamplesFromOtlpJson(body);
    let accepted = 0;
    for (const sample of extracted) {
      const ok = store.add(sample, {
        counterValue: sample.counterValue,
        requireCounterIncrease: true,
      });
      if (ok) {
        accepted += 1;
        persistSample(sample);
      }
    }

    if (outDir) {
      writeFileSync(
        join(outDir, 'last-otlp-request-meta.json'),
        `${JSON.stringify({
          receivedAtUtc: new Date().toISOString(),
          contentType: ct,
          heartbeatSamplesExtracted: extracted.length,
          heartbeatSamplesAccepted: accepted,
          otlpRequestCount: store.getOtlpRequestCount(),
        }, null, 2)}\n`,
        'utf8',
      );
    }

    return { ok: true, status: 200, extracted: extracted.length, accepted };
  }

  function start() {
    return new Promise((resolveStart, reject) => {
      server = http.createServer((req, res) => {
        if (req.method === 'GET' && req.url === '/healthz') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: true, otlpRequests: store.getOtlpRequestCount() }));
          return;
        }

        if (req.method === 'POST' && (req.url === '/v1/metrics' || req.url?.startsWith('/v1/metrics?'))) {
          /** @type {Buffer[]} */
          const chunks = [];
          req.on('data', (c) => chunks.push(c));
          req.on('end', () => {
            const raw = Buffer.concat(chunks);
            const result = handleMetricsBody(raw, req.headers['content-type']);
            res.writeHead(result.status, { 'content-type': 'application/json' });
            // Respuesta OTLP vacía / parcial success mínima
            res.end(result.ok ? '{}' : JSON.stringify({ error: result.error }));
          });
          return;
        }

        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'not_found' }));
      });

      server.once('error', reject);
      server.listen(port, host, () => {
        const addr = server.address();
        const boundPort = typeof addr === 'object' && addr ? addr.port : port;
        resolveStart({
          host,
          port: boundPort,
          url: `http://${host}:${boundPort}/v1/metrics`,
          endpointBase: `http://${host}:${boundPort}`,
        });
      });
    });
  }

  async function stop() {
    if (!server) return;
    const s = server;
    server = null;
    await new Promise((resolveStop, reject) => {
      s.close((err) => (err ? reject(err) : resolveStop()));
    });
  }

  return {
    store,
    start,
    stop,
    handleMetricsBody,
  };
}

async function main() {
  const args = process.argv.slice(2);
  let port = 4319;
  let outDir = resolve('seguridad-caos-exp3/otlp-local/out');
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--port') port = Number(args[i + 1]);
    if (args[i] === '--out') outDir = args[i + 1];
  }
  const receiver = createOtlpHttpMetricsReceiver({ port, outDir, maxAgeSec: 120 });
  const info = await receiver.start();
  console.log(JSON.stringify({
    msg: 'otlp-http-receiver-listening',
    ...info,
    outDir,
    note: 'OTLP JSON /v1/metrics. Para protobuf use otel-collector-config.yaml',
  }, null, 2));
}

const isDirect = process.argv[1] && process.argv[1].includes('otlp-http-receiver');
if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
