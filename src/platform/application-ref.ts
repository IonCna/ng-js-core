import type angular from "angular";
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
import { claimView, getViewOwner, releaseView, type ViewOwner } from "@/core/refs/view-owner.ts";
import type { ViewRef } from "@/core/refs/view-ref.ts";
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
    abstract readonly injector: angular.auto.IInjectorService;
    abstract readonly viewCount: number;
    abstract tick(): void;
    abstract whenStable(): Promise<void>;
    abstract attachView(viewRef: ViewRef): void;
    abstract detachView(viewRef: ViewRef): void;
    abstract onDestroy(callback: () => void): () => void;
    abstract destroy(): void;
}

export class ApplicationRefImpl extends ApplicationRef implements ViewOwner {
    static readonly $inject = ["$rootScope", "$injector", NgZone.$name, AfterRenderEventManager.$name] as const;

    readonly viewOwnerKind = "application" as const;

    readonly isStable: Observable<boolean>;

    private _destroyed = false;
    private readonly _destroyListeners = new Set<() => void>();
    private readonly views = new Set<ViewRef>();
    private readonly trackedViews = new WeakSet<ViewRef>();

    constructor(
        private readonly $rootScope: IRootScopeService,
        public readonly injector: angular.auto.IInjectorService,
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

    get viewCount(): number {
        return this.views.size;
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

    attachView(viewRef: ViewRef): void {
        this.assertNotDestroyed();

        if (viewRef.destroyed) {
            throw new Error("No se puede adjuntar una vista destruida");
        }

        const currentOwner = getViewOwner(viewRef);
        if (currentOwner === this) return;
        if (currentOwner) {
            throw new Error(`La vista ya pertenece a un ${currentOwner.viewOwnerKind}`);
        }

        claimView(viewRef, this);
        this.views.add(viewRef);

        try {
            viewRef.reattach();
        } catch (error) {
            this.views.delete(viewRef);
            releaseView(viewRef, this);
            throw error;
        }

        if (this.trackedViews.has(viewRef)) return;

        this.trackedViews.add(viewRef);
        viewRef.onDestroy(() => {
            this.views.delete(viewRef);
            releaseView(viewRef, this);
        });
    }

    detachView(viewRef: ViewRef): void {
        if (getViewOwner(viewRef) !== this) return;

        this.views.delete(viewRef);
        releaseView(viewRef, this);
        viewRef.detach();
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

        for (const viewRef of [...this.views]) viewRef.destroy();
        this.views.clear();

        for (const callback of this._destroyListeners) callback();
        this._destroyListeners.clear();

        this.$rootScope.$destroy();
    }

    private assertNotDestroyed(): void {
        if (this._destroyed) throw new Error("ApplicationRef ya fue destruido");
    }
}
