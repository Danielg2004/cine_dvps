import { adjustSaturationActive } from '../resilience/metrics.js';

export type SaturationConfig = {
    holdMs: number;
    maxInflight: number;
    durationSec: number;
};

type SaturationState = {
    active: boolean;
    startedAt: number | null;
    endsAt: number | null;
    config: SaturationConfig;
    appliedCount: number;
    timer: ReturnType<typeof setTimeout> | null;
};

const MAX_HOLD_MS = 2000;
const MAX_DURATION_SEC = 120;
const MAX_INFLIGHT = 32;

const state: SaturationState = {
    active: false,
    startedAt: null,
    endsAt: null,
    config: {
        holdMs: 200,
        maxInflight: 4,
        durationSec: 30,
    },
    appliedCount: 0,
    timer: null,
};

let chaosInflight = 0;
const waiters: Array<() => void> = [];

function clampConfig(input: Partial<SaturationConfig>): SaturationConfig {
    return {
        holdMs: Math.max(0, Math.min(Number(input.holdMs ?? 200), MAX_HOLD_MS)),
        maxInflight: Math.max(1, Math.min(Number(input.maxInflight ?? 4), MAX_INFLIGHT)),
        durationSec: Math.max(1, Math.min(Number(input.durationSec ?? 30), MAX_DURATION_SEC)),
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
        queueDepth: waiters.length,
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

    while (waiters.length > 0) {
        const next = waiters.shift();
        next?.();
    }

    return snapshotStatus();
}

async function acquireSlot(): Promise<void> {
    if (chaosInflight < state.config.maxInflight) {
        chaosInflight += 1;
        return;
    }

    await new Promise<void>((resolve) => {
        waiters.push(() => {
            chaosInflight += 1;
            resolve();
        });
    });
}

function releaseSlot(): void {
    chaosInflight = Math.max(0, chaosInflight - 1);
    const next = waiters.shift();
    if (next) {
        next();
    }
}

/**
 * Contención de concurrencia acotada: espera cupo y retiene holdMs.
 * Sin busy-loop ni memory leak.
 */
export async function applySaturationIfActive(): Promise<void> {
    const status = getSaturationStatus();
    if (!status.active) {
        return;
    }

    await acquireSlot();
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
