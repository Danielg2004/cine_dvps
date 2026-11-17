import { admissionMaxInflight } from './config.js';
import { recordAdmissionReject } from './metrics.js';

/**
 * Control de admisión: rechaza nuevas solicitudes cuando el inflight supera el umbral.
 */
export class AdmissionControl {
    private inflight = 0;

    getInflight(): number {
        return this.inflight;
    }

    tryAdmit(): { ok: true } | { ok: false; reason: string } {
        const limit = admissionMaxInflight();
        if (this.inflight >= limit) {
            recordAdmissionReject('inflight_limit');
            return { ok: false, reason: 'inflight_limit' };
        }
        this.inflight += 1;
        return { ok: true };
    }

    release(): void {
        this.inflight = Math.max(0, this.inflight - 1);
    }

    reset(): void {
        this.inflight = 0;
    }
}

export const experimentalAdmission = new AdmissionControl();
