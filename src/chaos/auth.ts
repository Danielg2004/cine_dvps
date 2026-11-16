import { timingSafeEqual } from 'node:crypto';

/**
 * Token de caos: CHAOS_FAULT_TOKEN (preferido) o CANARY_FAULT_TOKEN (legado V4).
 * Deshabilitado si no hay token >= 16 caracteres.
 */
export function isChaosControlAuthorized(headerValue: string | string[] | undefined): boolean {
    const configured =
        process.env.CHAOS_FAULT_TOKEN?.trim() ||
        process.env.CANARY_FAULT_TOKEN?.trim() ||
        '';

    if (configured.length < 16) {
        return false;
    }

    if (typeof headerValue !== 'string') {
        return false;
    }

    const expected = Buffer.from(configured);
    const received = Buffer.from(headerValue);
    if (expected.length !== received.length) {
        return false;
    }

    return timingSafeEqual(expected, received);
}
