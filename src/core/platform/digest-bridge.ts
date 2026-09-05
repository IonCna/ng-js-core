import "@/core/platform/zone-flags"
import "zone.js"
import { EventEmitter } from "@/event-emitter"
import { NgZone, NgZoneImpl } from "@/core/platform/ng-zone"

/**
 * Punta Zone del puente: forkea un zone, trackea sus tasks y emite eventos.
 * No conoce `$rootScope` — el `$digest` lo dispara `ApplicationRefImpl`
 * suscrito a `onMicrotaskEmpty`.
 */
export class NgZoneFactory {
    private _nesting = 0
    private _hasPendingMicrotasks = false
    private _hasPendingMacrotasks = false
    private _stable = true

    readonly onUnstable = new EventEmitter<void>()
    readonly onMicrotaskEmpty = new EventEmitter<void>()
    readonly onStable = new EventEmitter<void>()
    readonly onError = new EventEmitter<unknown>()

    private forked: Zone
    private parentZone: Zone

    private constructor() {
        const instance: NgZoneFactory = this

        this.forked = Zone.current.fork({
            name: NgZone.$name,
            properties: {
                [NgZone.$name]: true
            },
            onInvoke(delegate, _current, target, callback, applyThis, applyArgs, source) {
                instance.onEnter()

                try {
                    return delegate.invoke(target, callback, applyThis, applyArgs, source)
                } finally {
                    instance.onLeave()
                }
            },
            onInvokeTask: (delegate, _current, target, task, applyThis, applyArgs) => {
                instance.onEnter();
                try {
                    return delegate.invokeTask(target, task, applyThis, applyArgs);
                } finally {
                    instance.onLeave();
                }
            },
            onHasTask: (delegate, current, target, hasTaskState) => {
                delegate.hasTask(target, hasTaskState);
                if (current !== target) return;
                if (hasTaskState.change === "microTask") {
                    instance._hasPendingMicrotasks = hasTaskState.microTask;
                    instance.checkStable();
                } else if (hasTaskState.change === "macroTask") {
                    instance._hasPendingMacrotasks = hasTaskState.macroTask;
                }
            },
            onHandleError: (delegate, _current, target, error) => {
                const handled = delegate.handleError(target, error);
                instance.onError.emit(error);
                // sin suscriptor (todavía no hay ErrorHandler, etapa 2) el error
                // tiene que verse igual que uno no manejado; con suscriptor, él decide.
                if (!instance.onError.observed) {
                    queueMicrotask(() => {
                        throw error;
                    });
                }
                return handled;
            },
        })

        this.parentZone = this.forked.parent ?? Zone.root
    }

    private onEnter() {
        this._nesting++
        if (this._stable) {
            this._stable = false
            this.onUnstable.emit()
        }
    }

    private onLeave() {
        this._nesting--
        this.checkStable()
    }

    private checkStable() {
        if (this._nesting === 0 && !this._hasPendingMicrotasks && !this._stable) {
            this._nesting++   // guard de reentrada: trabajo agendado en el emit no re-dispara
            try {
                this.onMicrotaskEmpty.emit()
            } finally {
                this._nesting--
            }
            if (!this._hasPendingMicrotasks) {
                this._stable = true
                this.onStable.emit()
            }
        }
    }

    public run<T = any>(fn: () => T): T {
        return this.forked.run(fn)
    }

    public runOutside<T = any>(fn: () => T): T {
        return this.parentZone.run(fn)
    }

    get stable() {
        return this._stable;
    }

    get hasPendingMicrotasks() {
        return this._hasPendingMicrotasks;
    }

    get hasPendingMacrotasks() {
        return this._hasPendingMacrotasks;
    }

    static create(): NgZoneImpl {
        if (typeof Zone === "undefined") {
            throw new Error("NgZoneFactory: Zone.js must be defined");
        }

        const bridge = new NgZoneFactory();
        return new NgZoneImpl(bridge)
    }
}
