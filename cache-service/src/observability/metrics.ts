import { metrics } from '@opentelemetry/api';
import type { Counter } from '@opentelemetry/api';

export const CACHE_HITS = 'cache.hits';
export const CACHE_MISSES = 'cache.misses';

type Instruments = {
    hits: Counter;
    misses: Counter;
};

let instruments: Instruments | undefined;

function getInstruments(): Instruments {
    if (!instruments) {
        const meter = metrics.getMeter('cache-service');
        instruments = {
            hits: meter.createCounter(CACHE_HITS, {
                description: 'Cache HIT responses',
                unit: '{hit}',
            }),
            misses: meter.createCounter(CACHE_MISSES, {
                description: 'Cache MISS responses',
                unit: '{miss}',
            }),
        };
    }

    return instruments;
}

export function recordCacheResult(result: 'HIT' | 'MISS'): void {
    const current = getInstruments();
    if (result === 'HIT') {
        current.hits.add(1);
        return;
    }
    current.misses.add(1);
}
