import type angular from "angular";
import type { IPromise, IQService, IRootScopeService } from "angular";
import { defer, distinctUntilChanged, filter, firstValueFrom, map, merge, type Observable } from "rxjs";
import type { Binding } from "@/core";
import type { ComponentRef } from "@/core/abstractions/component-ref";
import { claimView, getViewOwner, releaseView, type ViewOwner } from "@/core/abstractions/view-owner";
import type { ViewRef } from "@/core/abstractions/view-ref";
import { createComponent } from "@/core/decorators/ng-create-component";
import { NgZone } from "@/core/ng-zone";

export interface BootstrapOptions {
  hostElement?: string | Element;
  directives?: string[];
  bindings?: Binding[];
}

export abstract class ApplicationRef {
  static get $name(): "ApplicationRef" {
    return "ApplicationRef";
  }

  abstract readonly destroyed: boolean;
  abstract readonly componentTypes: string[];
  abstract readonly components: ComponentRef<unknown>[];
  abstract readonly isStable: Observable<boolean>;
  abstract whenStable(): IPromise<void>;
  abstract readonly injector: angular.auto.IInjectorService;
  abstract bootstrap<C>(component: string, options?: BootstrapOptions): IPromise<ComponentRef<C>>;
  abstract bootstrap<C>(component: string, hostElement?: string | Element): IPromise<ComponentRef<C>>;
  abstract tick(): void;
  abstract attachView(viewRef: ViewRef): void;
  abstract detachView(viewRef: ViewRef): void;
  abstract onDestroy(callback: () => void): VoidFunction;
  abstract destroy(): void;
  abstract readonly viewCount: number;
}

export class ApplicationRefImpl extends ApplicationRef implements ViewOwner {
  readonly viewOwnerKind = "application" as const;
  private _destroyed = false;
  private readonly _componentTypes: string[] = [];
  private readonly _components: ComponentRef<unknown>[] = [];
  private readonly _views = new Set<ViewRef>();
  private readonly _trackedViews = new WeakSet<ViewRef>();
  private readonly _destroyListeners = new Set<() => void>();

  readonly isStable: Observable<boolean>;

  constructor(
    private readonly $rootScope: IRootScopeService,
    private readonly $q: IQService,
    public readonly injector: angular.auto.IInjectorService,
    private readonly ngZone: NgZone,
  ) {
    super();

    this.isStable = merge(
      defer(() => [this.ngZone.isStable]),
      this.ngZone.onUnstable.pipe(map(() => false)),
      this.ngZone.onStable.pipe(map(() => true)),
    ).pipe(distinctUntilChanged());
  }

  get destroyed(): boolean {
    return this._destroyed;
  }

  get componentTypes(): string[] {
    return [...this._componentTypes];
  }

  get components(): ComponentRef<unknown>[] {
    return [...this._components];
  }

  get viewCount(): number {
    return this._views.size;
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
    this._views.add(viewRef);
    try {
      viewRef.reattach();
    } catch (error) {
      this._views.delete(viewRef);
      releaseView(viewRef, this);
      throw error;
    }

    if (!this._trackedViews.has(viewRef)) {
      this._trackedViews.add(viewRef);
      viewRef.onDestroy(() => {
        this._views.delete(viewRef);
        releaseView(viewRef, this);
      });
    }
  }

  detachView(viewRef: ViewRef): void {
    if (getViewOwner(viewRef) !== this) return;
    this._views.delete(viewRef);
    releaseView(viewRef, this);
    viewRef.detach();
  }

  bootstrap<C>(component: string, options?: BootstrapOptions): IPromise<ComponentRef<C>>;
  bootstrap<C>(component: string, hostElement?: string | Element): IPromise<ComponentRef<C>>;
  bootstrap<C>(component: string, options?: BootstrapOptions | string | Element): IPromise<ComponentRef<C>> {
    this.assertNotDestroyed();

    const bootstrapOptions = this.normalizeBootstrapOptions(options);
    const hostElement = this.resolveHostElement(component, bootstrapOptions.hostElement);
    return createComponent<C>(component, {
      environmentInjector: this.injector,
      hostElement,
      directives: bootstrapOptions.directives,
      bindings: bootstrapOptions.bindings,
    }).then((componentRef) => {
      try {
        this.attachView(componentRef.hostView);
      } catch (error) {
        componentRef.destroy();
        return this.$q.reject(error);
      }

      this._components.push(componentRef);
      if (!this._componentTypes.includes(component)) this._componentTypes.push(component);

      componentRef.onDestroy(() => {
        const index = this._components.indexOf(componentRef);
        if (index !== -1) this._components.splice(index, 1);
      });

      return componentRef;
    });
  }

  destroy(): void {
    if (this._destroyed) return;

    this._destroyed = true;

    for (const viewRef of [...this._views]) viewRef.destroy();
    this._views.clear();
    this._components.splice(0);
    this._componentTypes.splice(0);

    for (const callback of this._destroyListeners) callback();
    this._destroyListeners.clear();

    this.$rootScope.$destroy();
  }

  onDestroy(callback: () => void): VoidFunction {
    this.assertNotDestroyed();
    this._destroyListeners.add(callback);

    return () => {
      this._destroyListeners.delete(callback);
    };
  }

  tick(): void {
    this.assertNotDestroyed();
    this.$rootScope.$applyAsync();
  }

  whenStable(): IPromise<void> {
    this.assertNotDestroyed();
    return this.$q.when(firstValueFrom(this.isStable.pipe(filter((stable) => stable)))).then(() => undefined);
  }

  static get $inject(): readonly ["$rootScope", "$q", "$injector", string] {
    return ["$rootScope", "$q", "$injector", NgZone.$name];
  }

  private normalizeBootstrapOptions(options?: BootstrapOptions | string | Element): BootstrapOptions {
    if (typeof options === "string" || this.isElement(options)) return { hostElement: options };
    return options ?? {};
  }

  private resolveHostElement(component: string, requestedHost?: string | Element): Element {
    const componentElementName = this.toKebabCase(component);
    const target =
      typeof requestedHost === "string"
        ? document.querySelector(requestedHost)
        : (requestedHost ?? document.querySelector(componentElementName));

    if (!target) {
      throw new Error(`No se encontró un elemento host para "${component}"`);
    }

    return target;
  }

  private toKebabCase(value: string): string {
    return value
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
      .toLowerCase();
  }

  private isElement(value: unknown): value is Element {
    return typeof Element !== "undefined" && value instanceof Element;
  }

  private assertNotDestroyed(): void {
    if (this._destroyed) throw new Error("ApplicationRef ya fue destruido");
  }
}
