import type { IScope } from "angular";

/**
 * Fachada de la detección de cambios de AngularJS.
 *
 * El compiler genera el polyfill que llama `$apply()` después de promesas,
 * timers y eventos. Las llamadas explícitas a `markForCheck()` se traducen a
 * `$evalAsync()` para iniciar un digest cuando el cambio ocurre fuera de esos
 * puntos de entrada.
 */
export abstract class ChangeDetectorRef {
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
    if (this.cdDestroyed || !this.attached) return;

    // `$evalAsync()` agenda el digest si no hay uno activo y es seguro si ya
    // estamos dentro de un ciclo. El callback no necesita hacer trabajo:
    // cualquier cambio ya ocurrió antes de marcar la vista.
    this.scope.$evalAsync(() => undefined);
  }

  detectChanges(): void {
    // `$$phase` se setea en la raíz durante un `$digest`; un scope hijo puede
    // tenerlo en `null` mientras la app está en pleno digest. Se comprueban
    // ambos para no provocar `$rootScope:inprog` desde un ciclo activo.
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
    this.markForCheck();
  }
}
