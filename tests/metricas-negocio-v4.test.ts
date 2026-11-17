import { afterEach, describe, expect, it, vi } from 'vitest';

const addReserva = vi.fn();

vi.mock('@opentelemetry/api', () => ({
    metrics: {
        getMeter: () => ({
            createCounter: (nombre: string) => ({
                add: nombre === 'cine.reservas.creadas'
                    ? addReserva
                    : vi.fn(),
            }),
            createHistogram: () => ({
                record: vi.fn(),
            }),
        }),
    },
}));

import { recordCineReservaCreada } from '../src/observability/metrics.js';

const trackOriginal = process.env.APP_TRACK;
const versionOriginal = process.env.APP_VERSION;

afterEach(() => {
    vi.clearAllMocks();

    if (trackOriginal === undefined) {
        delete process.env.APP_TRACK;
    } else {
        process.env.APP_TRACK = trackOriginal;
    }

    if (versionOriginal === undefined) {
        delete process.env.APP_VERSION;
    } else {
        process.env.APP_VERSION = versionOriginal;
    }
});

describe('Metrica de negocio Canary V4', () => {

    it('registra una reserva creada en Canary', () => {
        process.env.APP_TRACK = 'canary';
        process.env.APP_VERSION = '4.0.0';

        recordCineReservaCreada();

        expect(addReserva).toHaveBeenCalledWith(1, {
            'deployment.track': 'canary',
            'service.version': '4.0.0',
        });
    });

    it('identifica correctamente la version Stable', () => {
        process.env.APP_TRACK = 'stable';
        process.env.APP_VERSION = '1.0.0';

        recordCineReservaCreada();

        expect(addReserva).toHaveBeenCalledWith(1, {
            'deployment.track': 'stable',
            'service.version': '1.0.0',
        });
    });
});
