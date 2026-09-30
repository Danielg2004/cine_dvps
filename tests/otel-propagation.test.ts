import net from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { context, propagation, trace } from '@opentelemetry/api';
import { TraceState } from '@opentelemetry/core';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';

const execFileAsync = promisify(execFile);
const X_TRACE_ID = 'azure-otel-test-001';
const PELICULA_ID = '424242';

process.env.OTEL_LOGS_EXPORTER = 'none';

type SpanLine = {
    service: string;
    traceId: string;
    spanId: string;
    parentSpanId: string | null;
    kind: string;
    name: string;
};

type Running = {
    child: ChildProcess;
    output: string;
};

const memory = new InMemorySpanExporter();
const sdk = new NodeSDK({
    serviceName: 'orchestrator-test',
    instrumentations: [],
    spanProcessors: [new SimpleSpanProcessor(memory)],
    metricReaders: [],
});
sdk.start();

function portOpen(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = net.connect({ host: '127.0.0.1', port });
        const finish = (open: boolean) => {
            socket.removeAllListeners();
            socket.destroy();
            resolve(open);
        };
        socket.once('connect', () => finish(true));
        socket.once('error', () => finish(false));
    });
}

async function freePort(): Promise<number> {
    const server = net.createServer();
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
    return port;
}

async function ensureRedis(): Promise<void> {
    if (await portOpen(6379)) {
        return;
    }

    try {
        await execFileAsync('docker', ['start', 'cine-otel-redis-test']);
    } catch {
        await execFileAsync('docker', [
            'run', '-d', '--name', 'cine-otel-redis-test',
            '-p', '6379:6379', 'redis:7-alpine',
        ]);
    }

    for (let attempt = 0; attempt < 40; attempt += 1) {
        if (await portOpen(6379)) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new Error('Redis no disponible en 127.0.0.1:6379');
}

function serviceEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {
        ...process.env,
        OTEL_LOGS_EXPORTER: 'none',
        OTEL_SPAN_STDOUT: 'true',
        ...extra,
    };
    for (const key of [
        'OTEL_EXPORTER_OTLP_ENDPOINT',
        'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
        'OTEL_EXPORTER_OTLP_METRICS_ENDPOINT',
        'OTEL_EXPORTER_OTLP_LOGS_ENDPOINT',
        'OTEL_EXPORTER_OTLP_HEADERS',
        'OTEL_EXPORTER_OTLP_TRACES_HEADERS',
        'OTEL_EXPORTER_OTLP_METRICS_HEADERS',
        'OTEL_EXPORTER_OTLP_LOGS_HEADERS',
        'OTEL_SDK_DISABLED',
    ]) {
        delete env[key];
    }
    return env;
}

function startProcess(args: string[], env: NodeJS.ProcessEnv): Running {
    const child = spawn(process.execPath, args, {
        cwd: process.cwd(),
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    const running: Running = { child, output: '' };
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
        running.output += chunk;
    });
    child.stderr?.on('data', (chunk: string) => {
        running.output += chunk;
    });
    return running;
}

async function waitForText(running: Running, text: string): Promise<void> {
    const started = Date.now();
    while (Date.now() - started < 20_000) {
        if (running.output.includes(text)) {
            return;
        }
        if (running.child.exitCode !== null) {
            throw new Error(`proceso terminó (${running.child.exitCode}): ${running.output}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`timeout esperando "${text}": ${running.output}`);
}

function stop(running: Running | undefined): void {
    if (!running || running.child.exitCode !== null) {
        return;
    }
    running.child.kill();
}

function parseSpans(output: string): SpanLine[] {
    const spans: SpanLine[] = [];
    for (const line of output.split(/\r?\n/)) {
        const marker = 'OTEL_SPAN ';
        const index = line.indexOf(marker);
        if (index === -1) {
            continue;
        }
        spans.push(JSON.parse(line.slice(index + marker.length)) as SpanLine);
    }
    return spans;
}

function parseObjects(output: string): Array<Record<string, unknown>> {
    const rows: Array<Record<string, unknown>> = [];
    for (const line of output.split(/\r?\n/)) {
        const start = line.indexOf('{');
        if (start === -1) {
            continue;
        }
        try {
            const value: unknown = JSON.parse(line.slice(start));
            if (value && typeof value === 'object') {
                rows.push(value as Record<string, unknown>);
            }
        } catch {
            // La línea no es JSON completo.
        }
    }
    return rows;
}

describe('propagación W3C Cine → Cache', () => {
    let cache: Running | undefined;
    let cine: Running | undefined;
    let cachePort = 0;

    beforeAll(async () => {
        await ensureRedis();
        cachePort = await freePort();
        const cinePort = await freePort();

        cache = startProcess([
            '--import', 'tsx',
            '--import', '@opentelemetry/instrumentation/hook.mjs',
            '--import', './cache-service/src/observability/instrumentation.ts',
            './cache-service/src/server.ts',
        ], serviceEnv({
            PORT: String(cachePort),
            REDIS_URL: 'redis://127.0.0.1:6379',
            OTEL_SERVICE_NAME: 'cache-service',
        }));

        await waitForText(cache, 'Cache Service ejecutandose en el puerto');

        cine = startProcess([
            '--import', 'tsx',
            '--import', '@opentelemetry/instrumentation/hook.mjs',
            '--import', './src/observability/instrumentation.ts',
            './tests/harness/cine-otel-server.ts',
        ], serviceEnv({
            PORT: String(cinePort),
            CACHE_URL: `http://127.0.0.1:${cachePort}`,
            OTEL_SERVICE_NAME: 'cine-api',
        }));

        await waitForText(cine, 'HARNESS_READY cine');

        const seed = await fetch(`http://127.0.0.1:${cachePort}/cache`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-trace-id': X_TRACE_ID,
            },
            body: JSON.stringify({
                key: `pelicula:${PELICULA_ID}`,
                value: { id: Number(PELICULA_ID), nombre: 'otel' },
                ttl: 60,
            }),
        });
        if (seed.status !== 201) {
            throw new Error(`no se pudo sembrar cache: ${seed.status} ${await seed.text()}`);
        }
    }, 40_000);

    afterAll(async () => {
        if (cachePort) {
            await fetch(`http://127.0.0.1:${cachePort}/cache/pelicula:${PELICULA_ID}`, {
                method: 'DELETE',
            }).catch(() => undefined);
        }
        stop(cine);
        stop(cache);
        await sdk.shutdown();
    });

    it('continúa el mismo otelTraceId con spanIds distintos vía traceparent', async () => {
        const tracer = trace.getTracer('orchestrator-test');
        const carrier: Record<string, string> = {};
        let orchestratorTraceId = '';
        let orchestratorSpanId = '';

        await tracer.startActiveSpan('orchestrator', async (span) => {
            const base = span.spanContext();
            orchestratorTraceId = base.traceId;
            orchestratorSpanId = base.spanId;
            const traced = trace.setSpanContext(context.active(), {
                traceId: base.traceId,
                spanId: base.spanId,
                traceFlags: base.traceFlags,
                isRemote: false,
                traceState: new TraceState('vendor=azure'),
            });
            propagation.inject(traced, carrier);
            span.end();
        });

        expect(carrier.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/);
        expect(carrier.traceparent).toContain(orchestratorTraceId);
        expect(carrier.traceparent).toContain(orchestratorSpanId);
        expect(carrier.tracestate).toContain('vendor=azure');
        expect(orchestratorTraceId).not.toBe(X_TRACE_ID);

        const cinePort = Number(process.env.PORT);
        const ready = cine?.output.match(/HARNESS_READY cine (\d+)/);
        const port = ready ? Number(ready[1]) : cinePort;

        const response = await fetch(`http://127.0.0.1:${port}/api/v2/peliculas/${PELICULA_ID}`, {
            headers: {
                ...carrier,
                'x-trace-id': X_TRACE_ID,
            },
        });
        const body = await response.json() as { origen?: string; traceId?: string };
        expect(response.status).toBe(200);
        expect(body.origen).toBe('cache');
        expect(body.traceId).toBe(X_TRACE_ID);
        expect(response.headers.get('x-trace-id')).toBe(X_TRACE_ID);

        const health = await fetch(`http://127.0.0.1:${cachePort}/health`, {
            headers: { 'x-trace-id': X_TRACE_ID },
        });
        expect(health.headers.get('x-trace-id')).toBe(X_TRACE_ID);
        const healthBody = await health.json() as { traceId?: string };
        expect(healthBody.traceId).toBe(X_TRACE_ID);

        const started = Date.now();
        let spans: SpanLine[] = [];
        while (Date.now() - started < 5_000) {
            spans = parseSpans(`${cine?.output ?? ''}\n${cache?.output ?? ''}`);
            const readySpans = spans.some((span) =>
                span.service === 'cine-api' && span.kind === 'CLIENT' && span.traceId === orchestratorTraceId)
                && spans.some((span) =>
                    span.service === 'cache-service' && span.kind === 'SERVER' && span.traceId === orchestratorTraceId);
            if (readySpans) {
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
        }

        const cineServer = spans.find((span) =>
            span.service === 'cine-api' && span.kind === 'SERVER' && span.traceId === orchestratorTraceId);
        const cineClient = spans.find((span) =>
            span.service === 'cine-api' && span.kind === 'CLIENT' && span.traceId === orchestratorTraceId);
        const cacheServer = spans.find((span) =>
            span.service === 'cache-service' && span.kind === 'SERVER' && span.traceId === orchestratorTraceId);

        expect(cineServer, cine?.output).toBeTruthy();
        expect(cineClient, `${cine?.output}\n${cache?.output}`).toBeTruthy();
        expect(cacheServer, cache?.output).toBeTruthy();
        expect(cineServer?.parentSpanId).toBe(orchestratorSpanId);
        expect(cacheServer?.traceId).toBe(cineClient?.traceId);
        expect(cacheServer?.spanId).not.toBe(cineClient?.spanId);
        expect(cacheServer?.parentSpanId).toBe(cineClient?.spanId);

        const cacheLogs = parseObjects(cache?.output ?? '').filter((row) => row.otelTraceId === orchestratorTraceId);
        const cineLogs = parseObjects(cine?.output ?? '').filter((row) => row.otelTraceId === orchestratorTraceId);
        expect(cacheLogs.some((row) => row.xTraceId === X_TRACE_ID)).toBe(true);
        expect(cineLogs.some((row) => row.xTraceId === X_TRACE_ID)).toBe(true);

        const propagated = cacheLogs.find((row) => typeof row.traceparent === 'string');
        const traceparent = String(propagated?.traceparent ?? '');
        const parts = traceparent.split('-');
        expect(parts[1]).toBe(orchestratorTraceId);
        expect(parts[2]).toBe(cineClient?.spanId);
        expect(String(propagated?.tracestate ?? '')).toContain('vendor=azure');

        const proof = {
            prueba: 'Cine → Cache',
            xTraceId: X_TRACE_ID,
            traceparent,
            cine: {
                xTraceId: X_TRACE_ID,
                otelTraceId: cineClient?.traceId,
                spanId: cineClient?.spanId,
                kind: 'CLIENT',
            },
            cache: {
                xTraceId: X_TRACE_ID,
                otelTraceId: cacheServer?.traceId,
                spanId: cacheServer?.spanId,
                kind: 'SERVER',
            },
        };
        console.log(JSON.stringify(proof));
        const { writeFileSync } = await import('node:fs');
        const { tmpdir } = await import('node:os');
        const { join } = await import('node:path');
        writeFileSync(join(tmpdir(), 'cine-otel-proof.json'), JSON.stringify(proof));
    }, 30_000);
});
