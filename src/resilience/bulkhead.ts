import { bulkheadMaxConcurrent } from './config.js';
import { adjustBulkheadActive } from './metrics.js';

type Waiter = {
    resolve: () => void;
    reject: (error: Error) => void;
};

/**
 * Bulkhead: limita la concurrencia en la sección crítica experimental.
 */
export class Bulkhead {
    private active = 0;
    private readonly waiters: Waiter[] = [];

    getActive(): number {
        return this.active;
    }

    getQueueDepth(): number {
        return this.waiters.length;
    }

    async enter(timeoutMs = 2000): Promise<() => void> {
        const limit = bulkheadMaxConcurrent();

        if (this.active < limit) {
            this.active += 1;
            adjustBulkheadActive(1);
            return () => this.leave();
        }

        await new Promise<void>((resolve, reject) => {
            const waiter: Waiter = { resolve, reject };
            this.waiters.push(waiter);

            const timer = setTimeout(() => {
                const index = this.waiters.indexOf(waiter);
                if (index >= 0) {
                    this.waiters.splice(index, 1);
                }
                reject(new Error('bulkhead_timeout'));
            }, timeoutMs);

            const originalResolve = waiter.resolve;
            waiter.resolve = () => {
                clearTimeout(timer);
                originalResolve();
            };
        });

        this.active += 1;
        adjustBulkheadActive(1);
        return () => this.leave();
    }

    private leave(): void {
        this.active = Math.max(0, this.active - 1);
        adjustBulkheadActive(-1);
        const next = this.waiters.shift();
        if (next) {
            next.resolve();
        }
    }

    /** Uso en tests */
    reset(): void {
        while (this.waiters.length > 0) {
            const waiter = this.waiters.shift();
            waiter?.reject(new Error('bulkhead_reset'));
        }
        if (this.active !== 0) {
            adjustBulkheadActive(-this.active);
        }
        this.active = 0;
    }
}

export const experimentalBulkhead = new Bulkhead();
