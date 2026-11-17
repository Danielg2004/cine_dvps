import net from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { context, propagation, ROOT_CONTEXT } from '@opentelemetry/api';
import {
    createCinePropagator,
    firstValidTraceparent,
    SoftW3CTraceContextPropagator,
    W3C_TRACEPARENT_RE,
} from '../src/observability/w3c-propagator.js';

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

const KNOWN_TRACE = '0133858e26fb1057c5f9d3c464c9830f';
const PARENT_SPAN = 'ca37cf350c110511';
const OTHER_SPAN = '50e9354853345f23';

function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            const port = typeof address === 'object' && address ? address.port : 0;
            server.close((error) => (error ? reject(error) : resolve(port)));
        });
    });
}

function startHarness(port: number): Running {
    const env: NodeJS.ProcessEnv = {
        ...process.env,
        PORT: String(port),
        OTEL_SERVICE_NAME: 'cine-api',
        OTEL_LOGS_EXPORTER: 'none',
        OTEL_SPAN_STDOUT: 'true',
        OTEL_TRACES_EXPORTER: 'none',
        OTEL_METRICS_EXPORTER: 'none',
        CACHE_URL: '',
        DB_AUTO_INIT: 'false',
    };
    for (const key of [
        'OTEL_EXPORTER_OTLP_ENDPOINT',
        'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
        'OTEL_EXPORTER_OTLP_METRICS_ENDPOINT',
        'OTEL_EXPORTER_OTLP_HEADERS',
        'OTEL_SDK_DISABLED',
    ]) {
        delete env[key];
    }

    const child = spawn(process.execPath, [
        '--import', 'tsx',
        '--import', '@opentelemetry/instrumentation/hook.mjs',
        '--import', './src/observability/instrumentation.ts',
        './tests/harness/cine-w3c-server.ts',
    ], {
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

async function waitReady(running: Running): Promise<number> {
    const started = Date.now();
    while (Date.now() - started < 25_000) {
        const match = running.output.match(/HARNESS_READY cine-w3c (\d+)/);
        if (match) {
            return Number(match[1]);
        }
        if (running.child.exitCode !== null) {
            throw new Error(`harness exit ${running.child.exitCode}: ${running.output}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`timeout harness: ${running.output}`);
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

function parseLogs(output: string): Array<Record<string, unknown>> {
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
            // ignore
        }
    }
    return rows;
}

describe('normalización W3C traceparent', () => {
    it('acepta un traceparent válido', () => {
        const tp = `00-${KNOWN_TRACE}-${PARENT_SPAN}-01`;
        expect(firstValidTraceparent(tp)).toBe(tp);
        expect(W3C_TRACEPARENT_RE.test(tp)).toBe(true);
    });

    it('elige el primero válido cuando hay duplicados unidos por coma', () => {
        const a = `00-${KNOWN_TRACE}-${PARENT_SPAN}-01`;
        const b = `00-${KNOWN_TRACE}-${OTHER_SPAN}-01`;
        expect(firstValidTraceparent(`${a}, ${b}`)).toBe(a);
        expect(firstValidTraceparent([a, b])).toBe(a);
    });

    it('rechaza header inválido / ausente', () => {
        expect(firstValidTraceparent(undefined)).toBeUndefined();
        expect(firstValidTraceparent('not-a-traceparent')).toBeUndefined();
        expect(firstValidTraceparent('otel-oci-live-textual')).toBeUndefined();
    });

    it('SoftW3CTraceContextPropagator extrae Trace ID con header duplicado', () => {
        const propagator = new SoftW3CTraceContextPropagator();
        const a = `00-${KNOWN_TRACE}-${PARENT_SPAN}-01`;
        const b = `00-${KNOWN_TRACE}-${OTHER_SPAN}-01`;
        const carrier = { traceparent: `${a}, ${b}` };
        const extracted = propagator.extract(ROOT_CONTEXT, carrier, {
            keys: (c) => Object.keys(c),
            get: (c, key) => (c as Record<string, string>)[key],
        });
        const span = propagation.getBaggage?.(extracted);
        void span;
        // Usar API de contexto vía inject round-trip / getActive
        const out: Record<string, string> = {};
        // Extraer via Composite completo
        const composite = createCinePropagator();
        const ctx = composite.extract(ROOT_CONTEXT, carrier, {
            keys: (c) => Object.keys(c as object),
            get: (c, key) => (c as Record<string, string>)[key],
        });
        composite.inject(ctx, out, {
            set: (c, k, v) => {
                (c as Record<string, string>)[k] = v;
            },
        });
        expect(out.traceparent).toContain(KNOWN_TRACE);
        expect(out.traceparent).toContain(PARENT_SPAN);
        expect(context).toBeTruthy();
    });
});

describe('Cine SERVER span continúa contexto W3C entrante', () => {
    let running: Running | undefined;
    let port = 0;

    beforeAll(async () => {
        port = await freePort();
        running = startHarness(port);
        port = await waitReady(running);
    }, 40_000);

    afterAll(() => {
        if (running && running.child.exitCode === null) {
            running.child.kill();
        }
    });

    async function waitServerSpan(traceId: string): Promise<SpanLine | undefined> {
        const started = Date.now();
        while (Date.now() - started < 8_000) {
            const spans = parseSpans(running?.output ?? '');
            const hit = spans.find((span) =>
                span.service === 'cine-api'
                && span.kind === 'SERVER'
                && span.traceId === traceId);
            if (hit) {
                return hit;
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return undefined;
    }

    it('conserva Trace ID y parent con traceparent único', async () => {
        const tp = `00-${KNOWN_TRACE}-${PARENT_SPAN}-01`;
        const response = await fetch(`http://127.0.0.1:${port}/healthz`, {
            headers: {
                Accept: 'application/json',
                'x-trace-id': 'biz-single',
                traceparent: tp,
                tracestate: 'vendor=sports',
            },
        });
        expect(response.status).toBe(200);
        expect(response.headers.get('x-trace-id')).toBe('biz-single');
        expect(response.headers.get('traceparent')).toBe(tp);
        expect(response.headers.get('tracestate')).toBe('vendor=sports');

        const server = await waitServerSpan(KNOWN_TRACE);
        expect(server, running?.output).toBeTruthy();
        expect(server?.traceId).toBe(KNOWN_TRACE);
        expect(server?.parentSpanId).toBe(PARENT_SPAN);
        expect(server?.spanId).not.toBe(PARENT_SPAN);
        expect(server?.spanId).toMatch(/^[0-9a-f]{16}$/);

        const log = parseLogs(running?.output ?? '').find((row) =>
            row.xTraceId === 'biz-single' && row.otelTraceId === KNOWN_TRACE);
        expect(log).toBeTruthy();
        expect(log?.otelSpanId).toBe(server?.spanId);
    }, 20_000);

    it('conserva Trace ID con traceparent duplicado (defecto Sports)', async () => {
        const a = `00-${KNOWN_TRACE}-aaaaaaaaaaaaaaaa-01`;
        const b = `00-${KNOWN_TRACE}-bbbbbbbbbbbbbbbb-01`;
        const response = await fetch(`http://127.0.0.1:${port}/healthz`, {
            headers: {
                'x-trace-id': 'biz-dup',
                // Simula Node uniendo headers duplicados
                traceparent: `${a}, ${b}`,
            },
        });
        expect(response.status).toBe(200);
        expect(response.headers.get('x-trace-id')).toBe('biz-dup');
        expect(response.headers.get('traceparent')).toBe(a);

        const server = await waitServerSpan(KNOWN_TRACE);
        // Puede haber spans previos del mismo trace; buscar el que tenga parent aaaa...
        const started = Date.now();
        let match: SpanLine | undefined;
        while (Date.now() - started < 8_000) {
            match = parseSpans(running?.output ?? '').find((span) =>
                span.service === 'cine-api'
                && span.kind === 'SERVER'
                && span.traceId === KNOWN_TRACE
                && span.parentSpanId === 'aaaaaaaaaaaaaaaa');
            if (match) {
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        expect(match, running?.output).toBeTruthy();
        expect(match?.spanId).not.toBe('aaaaaaaaaaaaaaaa');
        expect(server).toBeTruthy();
    }, 20_000);

    it('sin traceparent crea traza propia y preserva x-trace-id de negocio', async () => {
        const before = parseSpans(running?.output ?? '').length;
        const response = await fetch(`http://127.0.0.1:${port}/healthz`, {
            headers: { 'x-trace-id': 'solo-negocio' },
        });
        expect(response.status).toBe(200);
        expect(response.headers.get('x-trace-id')).toBe('solo-negocio');

        const started = Date.now();
        let log: Record<string, unknown> | undefined;
        while (Date.now() - started < 5_000) {
            log = parseLogs(running?.output ?? '').find((row) => row.xTraceId === 'solo-negocio');
            if (log) {
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        expect(log).toBeTruthy();
        expect(log?.xTraceId).toBe('solo-negocio');
        expect(typeof log?.otelTraceId).toBe('string');
        expect(log?.otelTraceId).not.toBe('solo-negocio');
        expect(parseSpans(running?.output ?? '').length).toBeGreaterThan(before);
    }, 15_000);

    it('traceparent inválido no se convierte desde x-trace-id textual', async () => {
        const response = await fetch(`http://127.0.0.1:${port}/healthz`, {
            headers: {
                'x-trace-id': 'otel-oci-live-textual-id',
                traceparent: 'invalid-header',
            },
        });
        expect(response.status).toBe(200);
        expect(response.headers.get('x-trace-id')).toBe('otel-oci-live-textual-id');
        expect(response.headers.get('traceparent') ?? null).toBeNull();

        const started = Date.now();
        let log: Record<string, unknown> | undefined;
        while (Date.now() - started < 5_000) {
            log = parseLogs(running?.output ?? '').find((row) =>
                row.xTraceId === 'otel-oci-live-textual-id');
            if (log) {
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        expect(log?.otelTraceId).not.toBe('otel-oci-live-textual-id');
        expect(String(log?.otelTraceId)).toMatch(/^[0-9a-f]{32}$/);
    }, 15_000);

    it('solicitudes concurrentes conservan Trace IDs distintos', async () => {
        const t1 = '11111111111111111111111111111111';
        const t2 = '22222222222222222222222222222222';
        await Promise.all([
            fetch(`http://127.0.0.1:${port}/healthz`, {
                headers: {
                    'x-trace-id': 'c1',
                    traceparent: `00-${t1}-1111111111111111-01`,
                },
            }),
            fetch(`http://127.0.0.1:${port}/healthz`, {
                headers: {
                    'x-trace-id': 'c2',
                    traceparent: `00-${t2}-2222222222222222-01`,
                },
            }),
        ]);

        const started = Date.now();
        let s1: SpanLine | undefined;
        let s2: SpanLine | undefined;
        while (Date.now() - started < 8_000) {
            const spans = parseSpans(running?.output ?? '');
            s1 = spans.find((span) => span.kind === 'SERVER' && span.traceId === t1);
            s2 = spans.find((span) => span.kind === 'SERVER' && span.traceId === t2);
            if (s1 && s2) {
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        expect(s1?.parentSpanId).toBe('1111111111111111');
        expect(s2?.parentSpanId).toBe('2222222222222222');
        expect(s1?.spanId).not.toBe(s2?.spanId);
    }, 20_000);
});
