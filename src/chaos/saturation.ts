import { adjustSaturationActive } from '../resilience/metrics.js';

export type SaturationConfig = {
    holdMs: number;
    maxInflight: number;
    durationSec: number;
    /** Espera máxima por un cupo de saturación; evita cola ilimitada (mismo en R0/R1). */
    maxQueueWaitMs: number;
};

type SaturationState = {
    active: boolean;
    startedAt: number | null;
    endsAt: number | null;
    config: SaturationConfig;
    appliedCount: number;
    timer: ReturnType<typeof setTimeout> | null;
};

type SlotWaiter = {
    resolve: (result: 'acquired' | 'timeout') => void;
    timer: ReturnType<typeof setTimeout> | null;
};

const MAX_HOLD_MS = 2000;
const MAX_DURATION_SEC = 120;
const MAX_INFLIGHT = 32;
const MAX_QUEUE_WAIT_MS = 5000;

const state: SaturationState = {
    active: false,
    startedAt: null,
    endsAt: null,
    config: {
        holdMs: 200,
        maxInflight: 4,
        durationSec: 30,
        maxQueueWaitMs: 500,
    },
    appliedCount: 0,
    timer: null,
};

let chaosInflight = 0;
const slotWaiters: SlotWaiter[] = [];

function clampConfig(input: Partial<SaturationConfig>): SaturationConfig {
    return {
        holdMs: Math.max(0, Math.min(Number(input.holdMs ?? 200), MAX_HOLD_MS)),
        maxInflight: Math.max(1, Math.min(Number(input.maxInflight ?? 4), MAX_INFLIGHT)),
        durationSec: Math.max(1, Math.min(Number(input.durationSec ?? 30), MAX_DURATION_SEC)),
        maxQueueWaitMs: Math.max(
            0,
            Math.min(Number(input.maxQueueWaitMs ?? 500), MAX_QUEUE_WAIT_MS)
        ),
    };
}

export type SaturationStatus = {
    active: boolean;
    startedAt: number | null;
    endsAt: number | null;
    config: SaturationConfig;
    appliedCount: number;
    chaosInflight: number;
    queueDepth: number;
    limits: {
        maxHoldMs: number;
        maxDurationSec: number;
        maxInflight: number;
    };
};

function snapshotStatus(): SaturationStatus {
    return {
        active: state.active,
        startedAt: state.startedAt,
        endsAt: state.endsAt,
        config: { ...state.config },
        appliedCount: state.appliedCount,
        chaosInflight,
        queueDepth: slotWaiters.length,
        limits: {
            maxHoldMs: MAX_HOLD_MS,
            maxDurationSec: MAX_DURATION_SEC,
            maxInflight: MAX_INFLIGHT,
        },
    };
}

export function getSaturationStatus(): SaturationStatus {
    if (state.active && state.endsAt && Date.now() >= state.endsAt) {
        stopSaturation('expired');
    }
    return snapshotStatus();
}

export function startSaturation(input: Partial<SaturationConfig> = {}): SaturationStatus {
    if (state.active) {
        stopSaturation('restart');
    }

    const config = clampConfig(input);
    state.active = true;
    state.startedAt = Date.now();
    state.endsAt = state.startedAt + config.durationSec * 1000;
    state.config = config;
    state.appliedCount = 0;
    adjustSaturationActive(1);

    console.log(JSON.stringify({
        service: 'cine-api',
        msg: 'saturation_started',
        config,
        endsAt: state.endsAt,
    }));

    state.timer = setTimeout(() => {
        stopSaturation('timeout');
    }, config.durationSec * 1000);

    return getSaturationStatus();
}

export function stopSaturation(reason = 'manual'): SaturationStatus {
    if (state.timer) {
        clearTimeout(state.timer);
        state.timer = null;
    }

    if (state.active) {
        adjustSaturationActive(-1);
        console.log(JSON.stringify({
            service: 'cine-api',
            msg: 'saturation_stopped',
            reason,
            appliedCount: state.appliedCount,
        }));
    }

    state.active = false;
    state.startedAt = null;
    state.endsAt = null;

    while (slotWaiters.length > 0) {
        const next = slotWaiters.shift();
        if (!next) {
            break;
        }
        if (next.timer) {
            clearTimeout(next.timer);
            next.timer = null;
        }
        next.resolve('timeout');
    }

    return snapshotStatus();
}

async function acquireSlot(maxQueueWaitMs: number): Promise<'acquired' | 'timeout'> {
    if (chaosInflight < state.config.maxInflight) {
        chaosInflight += 1;
        return 'acquired';
    }

    if (maxQueueWaitMs <= 0) {
        return 'timeout';
    }

    return await new Promise<'acquired' | 'timeout'>((resolve) => {
        const waiter: SlotWaiter = {
            resolve,
            timer: null,
        };
        slotWaiters.push(waiter);
        waiter.timer = setTimeout(() => {
            const index = slotWaiters.indexOf(waiter);
            if (index >= 0) {
                slotWaiters.splice(index, 1);
                resolve('timeout');
            }
        }, maxQueueWaitMs);
    });
}

function releaseSlot(): void {
    chaosInflight = Math.max(0, chaosInflight - 1);
    const next = slotWaiters.shift();
    if (next) {
        if (next.timer) {
            clearTimeout(next.timer);
            next.timer = null;
        }
        chaosInflight += 1;
        next.resolve('acquired');
    }
}

export class SaturationQueueTimeoutError extends Error {
    constructor() {
        super('saturation_queue_timeout');
        this.name = 'SaturationQueueTimeoutError';
    }
}

/**
 * Contención de concurrencia acotada: espera cupo (con tope) y retiene holdMs.
 * Sin busy-loop ni memory leak. El tope de cola aplica igual en R0 y R1.
 */
export async function applySaturationIfActive(): Promise<void> {
    const status = getSaturationStatus();
    if (!status.active) {
        return;
    }

    const acquired = await acquireSlot(status.config.maxQueueWaitMs);
    if (acquired === 'timeout') {
        throw new SaturationQueueTimeoutError();
    }

    state.appliedCount += 1;
    try {
        await new Promise((resolve) => setTimeout(resolve, status.config.holdMs));
    } finally {
        releaseSlot();
    }
}

export function resetSaturationForTests(): void {
    stopSaturation('test_reset');
    chaosInflight = 0;
    state.appliedCount = 0;
}
