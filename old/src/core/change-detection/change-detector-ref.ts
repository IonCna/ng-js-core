import type { IScope } from "angular";

/**
 * Passthrough fino — no se reimplementa detección de cambios (ver CONCEPTOS
 * "Detección de cambios"). `markForCheck()` es no-op porque Zone.js ya
 * garantiza un `$digest` en cuanto se vacía la cola de microtasks; con Zone
 * no hay CD por componente que saltear, así que no hace falta "marcar" nada.
 */
export abstract class ChangeDetectorRef {
  static readonly $name = "ChangeDetectorRef";

  abstract markForCheck(): void;
  abstract detach(): void;
  abstract detectChanges(): void;
  abstract reattach(): void;
}

export class ChangeDetectorRefImpl extends ChangeDetectorRef {
  private attached = true;
  // nombre distinto al `destroyed` público que declara ViewRefImpl (subclase) —
  // mismo nombre en las dos causaría un choque de "override" en TS.
  private cdDestroyed = false;

  constructor(protected readonly scope: IScope) {
    super();

    scope.$on("$destroy", () => {
      this.cdDestroyed = true;
      this.attached = false;
    });
  }

  markForCheck(): void {
    // no-op: con Zone.js ya va a haber un $digest solo.
  }

  detectChanges(): void {
    // `$$phase` se setea en la raíz durante un `$digest`; un scope hijo puede
    // tenerlo en `null` mientras la app está en pleno digest. Chequear ambos
    // para no tirar `$rootScope:inprog` si se llama desde adentro de un ciclo.
    if (this.cdDestroyed || this.scope.$$phase || this.scope.$root?.$$phase) return;
    this.scope.$digest();
  }

  detach(): void {
    if (this.cdDestroyed) return;
    this.attached = false;
    this.scope.$suspend();
  }

  reattach(): void {
    if (this.cdDestroyed || this.attached) return;
    this.attached = true;
    this.scope.$resume();
  }
}
