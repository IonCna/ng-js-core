import type angular from "angular";
import type { ChangeDetectorRef } from "@/core/change-detection/change-detector-ref.ts";
import type { ComponentRef } from "@/core/refs/component-ref.ts";
import type { ElementRef } from "@/core/refs/element-ref.ts";

/** `$$testability` de AngularJS: avisa cuando no quedan `$http`/`$timeout`/`$evalAsync` pendientes. */
interface Testability {
  whenStable(callback: () => void): void;
}

/**
 * El `ComponentFixture` de Angular sobre un `ComponentRef` de `ngjs-core`. Como en Angular, la vista arranca
 * desenganchada de la detección de cambios global (el `$scope` suspendido): el template recién se actualiza con
 * `detectChanges()`, o solo tras `autoDetectChanges()`.
 *
 * Diferencia con Angular: AngularJS construye el controller y corre `$onInit` al enlazar, así que `ngOnInit` ya
 * corrió cuando `TestBed.createComponent()` devuelve el fixture (no espera al primer `detectChanges()`).
 */
export class ComponentFixture<T> {
  readonly componentInstance: T;
  readonly elementRef: ElementRef<HTMLElement>;
  readonly nativeElement: HTMLElement;
  readonly changeDetectorRef: ChangeDetectorRef;
  private autoDetect = false;
  private destroyed = false;

  constructor(
    readonly componentRef: ComponentRef<T>,
    private readonly $injector: angular.auto.IInjectorService,
    /** El `<div id="rootN">` que `TestBed` agregó al documento para este fixture. */
    private readonly rootElement: Element,
  ) {
    this.componentInstance = componentRef.instance;
    this.elementRef = componentRef.location;
    this.nativeElement = componentRef.location.nativeElement;
    this.changeDetectorRef = componentRef.changeDetectorRef;
  }

  /**
   * Digest de la vista del componente. `checkNoChanges` se acepta por compatibilidad: el digest de AngularJS ya
   * itera hasta que nada cambia (o tira `$rootScope:infdig`).
   */
  detectChanges(checkNoChanges = true): void {
    void checkNoChanges;
    const view = this.componentRef.hostView;
    if (this.autoDetect) {
      view.detectChanges();
      return;
    }
    view.reattach();
    try {
      view.detectChanges();
    } finally {
      view.detach();
    }
  }

  /** Nada que verificar: ver `detectChanges()`. */
  checkNoChanges(): void {}

  /** Engancha la vista al digest global (lo dispara el compilador tras eventos, promesas y timers). */
  autoDetectChanges(autoDetect = true): void {
    this.autoDetect = autoDetect;
    if (autoDetect) {
      this.componentRef.hostView.reattach();
      this.detectChanges();
    } else {
      this.componentRef.hostView.detach();
    }
  }

  isStable(): boolean {
    let stable = false;
    this.testability.whenStable(() => {
      stable = true;
    });
    return stable;
  }

  /** Como en Angular: `false` si ya estaba estable, `true` cuando termina lo pendiente. */
  whenStable(): Promise<boolean> {
    if (this.isStable()) return Promise.resolve(false);
    return new Promise((resolve) => this.testability.whenStable(() => resolve(true)));
  }

  whenRenderingDone(): Promise<boolean> {
    return this.whenStable();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    try {
      this.componentRef.destroy();
    } finally {
      this.rootElement.remove();
    }
  }

  private get testability(): Testability {
    return this.$injector.get<Testability>("$$testability");
  }
}
