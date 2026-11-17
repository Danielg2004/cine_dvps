import { afterEach, describe, expect, it, vi } from 'vitest';
import { context, propagation, trace } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { buildApp } from '../src/app.js';
import { AppDataSourceV2 } from '../src/config/database-v2.js';
import * as cacheClient from '../src/clients/cache.client.js';
import { resolveBusinessTraceId } from '../src/observability/correlation.js';

const exporter = new InMemorySpanExporter();
const sdk = new NodeSDK({
    serviceName: 'sports-simulator',
    instrumentations: [],
    spanProcessors: [new SimpleSpanProcessor(exporter)],
    metricReaders: [],
});
sdk.start();

describe('Trazabilidad distribuida Sports → Cine', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        exporter.reset();
    });

    it('preserva x-trace-id y echo de traceparent/tracestate', async () => {
        vi.spyOn(cacheClient, 'obtenerCache').mockResolvedValue(null);
        vi.spyOn(AppDataSourceV2, 'getRepository').mockReturnValue({
            findOneBy: vi.fn().mockResolvedValue({
                id: 1,
                nombre: 'T',
                duracion: 100,
                genero: 'Drama',
                descripcion: 'x',
            }),
        } as never);
        vi.spyOn(cacheClient, 'guardarCache').mockResolvedValue(null);

        const app = buildApp();
        try {
            const respuesta = await app.inject({
                method: 'GET',
                url: '/api/v2/peliculas/1',
                headers: {
                    'x-trace-id': 'sports-corr-42',
                    traceparent: '00-11111111111111111111111111111111-2222222222222222-01',
                    tracestate: 'vendor=sports',
                },
            });

            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.headers['x-trace-id']).toBe('sports-corr-42');
            expect(respuesta.headers.traceparent).toContain('11111111111111111111111111111111');
            expect(respuesta.headers.tracestate).toBe('vendor=sports');
            expect(respuesta.json().traceId).toBe('sports-corr-42');
        } finally {
            await app.close();
        }
    });

    it('no inventa un correlacionador distinto cuando ya hay x-trace-id', async () => {
        const fakeRequest = {
            headers: { 'x-trace-id': 'keep-me' },
        } as never;

        expect(resolveBusinessTraceId(fakeRequest)).toBe('keep-me');
    });

    it('Sports puede inyectar traceparent W3C válido hacia Cine', async () => {
        const tracer = trace.getTracer('sports-simulator');
        const span = tracer.startSpan('sports.call.cine');
        const carrier: Record<string, string> = { 'x-trace-id': 'sports-w3c-1' };

        context.with(trace.setSpan(context.active(), span), () => {
            propagation.inject(context.active(), carrier);
        });
        span.end();

        expect(carrier.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/);
        expect(carrier['x-trace-id']).toBe('sports-w3c-1');

        vi.spyOn(cacheClient, 'obtenerCache').mockResolvedValue({
            value: { id: 1, nombre: 'Cached' },
        });

        const app = buildApp();
        try {
            const respuesta = await app.inject({
                method: 'GET',
                url: '/api/v2/peliculas/1',
                headers: carrier,
            });

            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.headers['x-trace-id']).toBe('sports-w3c-1');
        } finally {
            await app.close();
        }
    });
});
