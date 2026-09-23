import type { IRootScopeService } from "angular";
import { EventEmitter } from "@/core/event-emitter.ts";

/**
 * Fachada compatible con `NgZone`. No crea ni usa un Zone real: conecta la
 * sintaxis Angular con el digest de AngularJS y deja que el compiler cubra el
 * trabajo async global.
 */
export abstract class NgZone {
    static readonly $name = "NgZone";

    readonly onUnstable = new EventEmitter<void>();
    readonly onMicrotaskEmpty = new EventEmitter<void>();
    readonly onStable = new EventEmitter<void>();
    readonly onError = new EventEmitter<unknown>();

    protected constructor(protected readonly $rootScope: IRootScopeService) {}

    get isStable(): boolean {
        return !this.$rootScope.$$phase;
    }

    get hasPendingMicrotasks(): boolean {
        return false;
    }

    get hasPendingMacrotasks(): boolean {
        return false;
    }

    abstract run<T>(fn: () => T): T;
    abstract runGuarded<T>(fn: () => T): T | undefined;
    abstract runTask<T>(fn: () => T): T;
    abstract runOutsideAngular<T>(fn: () => T): T;

    static isInAngularZone(): boolean {
        return true;
    }

    static assertInAngularZone(): void {}

    static assertNotInAngularZone(): void {}
}

export class NgZoneImpl extends NgZone {
    private running = 0;
    private stableScheduled = false;

    run<T>(fn: () => T): T {
        this.enter();
        try {
            return fn();
        } catch (error) {
            this.onError.emit(error);
            throw error;
        } finally {
            this.leave();
        }
    }

    runGuarded<T>(fn: () => T): T | undefined {
        try {
            return this.run(fn);
        } catch {
            return undefined;
        }
    }

    runTask<T>(fn: () => T): T {
        return this.run(fn);
    }

    runOutsideAngular<T>(fn: () => T): T {
        return fn();
    }

    private enter(): void {
        if (this.running++ === 0) this.onUnstable.emit();
    }

    private leave(): void {
        if (--this.running !== 0 || this.stableScheduled) return;
        this.stableScheduled = true;

        const notify = () => {
            this.stableScheduled = false;
            this.onMicrotaskEmpty.emit();
            this.onStable.emit();
        };

        // `$evalAsync()` es la API pública que cubre ambos casos: si ya hay
        // digest, agrega el callback al ciclo actual; si no, agenda uno nuevo.
        this.$rootScope.$evalAsync(notify);
    }
}
