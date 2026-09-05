import type { IRootScopeService } from "angular";
import {
    defer,
    distinctUntilChanged,
    filter,
    firstValueFrom,
    map,
    merge,
    type Observable,
} from "rxjs";
import { AfterRenderEventManager } from "@/core/lifecycle/after-render-event-manager.ts";
import { NgZone } from "@/platform/ng-zone";

/**
 * Servicio de aplicación: cablea el {@link NgZone} al digest de AngularJS y
 * expone el estado de estabilidad. `bootstrap` / `attachView` / `detachView` /
 * `components` → etapa 6 (necesitan `ComponentRef` / `ViewRef`); ver
 * `reference/src/core/abstractions/application-ref.ts` para la forma final.
 */
export abstract class ApplicationRef {
    static readonly $name = "ApplicationRef";

    abstract readonly isStable: Observable<boolean>;
    abstract readonly destroyed: boolean;
    abstract tick(): void;
    abstract whenStable(): Promise<void>;
    abstract onDestroy(callback: () => void): () => void;
    abstract destroy(): void;
}

export class ApplicationRefImpl extends ApplicationRef {
    static readonly $inject = ["$rootScope", NgZone.$name, AfterRenderEventManager.$name] as const;

    readonly isStable: Observable<boolean>;

    private _destroyed = false;
    private readonly _destroyListeners = new Set<() => void>();

    constructor(
        private readonly $rootScope: IRootScopeService,
        private readonly ngZone: NgZone,
        private readonly afterRenderEventManager: AfterRenderEventManager,
    ) {
        super();

        this.isStable = merge(
            defer(() => [this.ngZone.isStable]),
            this.ngZone.onUnstable.pipe(map(() => false)),
            this.ngZone.onStable.pipe(map(() => true)),
        ).pipe(distinctUntilChanged());

        // el cable: cola de microtasks vacía → un digest guardado
        this.ngZone.onMicrotaskEmpty.subscribe(() => this.tick());
    }

    get destroyed(): boolean {
        return this._destroyed;
    }

    tick(): void {
        if (this._destroyed || this.$rootScope.$$phase) return;
        this.$rootScope.$digest();
        this.afterRenderEventManager.notify();
    }

    whenStable(): Promise<void> {
        return firstValueFrom(
            this.isStable.pipe(
                filter((stable) => stable),
                map(() => undefined),
            ),
        );
    }

    onDestroy(callback: () => void): () => void {
        this.assertNotDestroyed();
        this._destroyListeners.add(callback);
        return () => {
            this._destroyListeners.delete(callback);
        };
    }

    destroy(): void {
        if (this._destroyed) return;
        this._destroyed = true;

        for (const callback of this._destroyListeners) callback();
        this._destroyListeners.clear();

        this.$rootScope.$destroy();
    }

    private assertNotDestroyed(): void {
        if (this._destroyed) throw new Error("ApplicationRef ya fue destruido");
    }
}
