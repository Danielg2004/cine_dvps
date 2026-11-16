import { context, propagation } from '@opentelemetry/api';

export type CacheLookupResult = {
    value: unknown;
} | null;

function cacheBaseUrl(): string {
    return process.env.CACHE_URL?.trim() || '';
}

function correlationHeaders(traceId: string): Record<string, string> {
    const headers: Record<string, string> = {
        'x-trace-id': traceId,
    };

    propagation.inject(context.active(), headers);

    return headers;
}

export function isCacheConfigured(): boolean {
    return cacheBaseUrl().length > 0;
}

export async function obtenerCache(
    key: string,
    traceId: string
): Promise<CacheLookupResult> {
    const baseUrl = cacheBaseUrl();
    if (!baseUrl) {
        return null;
    }

    try {
        const response = await fetch(
            `${baseUrl}/cache/${key}`,
            {
                method: 'GET',
                headers: correlationHeaders(traceId),
                signal: AbortSignal.timeout(1500),
            }
        );

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            console.error(JSON.stringify({
                service: 'cine-api',
                msg: 'cache_get_degraded',
                status: response.status,
                xTraceId: traceId,
            }));
            return null;
        }

        return await response.json() as CacheLookupResult;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'error de cache';
        console.error(JSON.stringify({
            service: 'cine-api',
            msg: 'cache_get_degraded',
            error: message,
            xTraceId: traceId,
        }));
        return null;
    }
}

export async function guardarCache(
    key: string,
    value: unknown,
    ttl: number,
    traceId: string
): Promise<unknown | null> {
    const baseUrl = cacheBaseUrl();
    if (!baseUrl) {
        return null;
    }

    try {
        const response = await fetch(
            `${baseUrl}/cache`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...correlationHeaders(traceId),
                },
                body: JSON.stringify({
                    key,
                    value,
                    ttl,
                }),
                signal: AbortSignal.timeout(1500),
            }
        );

        if (!response.ok) {
            console.error(JSON.stringify({
                service: 'cine-api',
                msg: 'cache_set_degraded',
                status: response.status,
                xTraceId: traceId,
            }));
            return null;
        }

        return await response.json();
    } catch (error) {
        const message = error instanceof Error ? error.message : 'error de cache';
        console.error(JSON.stringify({
            service: 'cine-api',
            msg: 'cache_set_degraded',
            error: message,
            xTraceId: traceId,
        }));
        return null;
    }
}
