import type { IScope } from "angular";
import { Injectable } from "@/core/di/injectable.ts";

/**
 * Fachada de la detección de cambios de AngularJS.
 *
 * El compiler genera el polyfill que llama `$apply()` después de promesas,
 * timers y eventos. Las llamadas explícitas a `markForCheck()` se traducen a
 * `$evalAsync()` para iniciar un digest cuando el cambio ocurre fuera de esos
 * puntos de entrada.
 */
@Injectable()
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
    if (this.cdDestroyed) return;
    // `$$phase` se setea en la raíz; un scope hijo (aislado) puede tenerlo en
    // `null` mientras la app está en pleno ciclo. Se comprueban ambos.
    const root = this.scope.$root as IScope & { $$phase: string | null };
    const phase = root?.$$phase ?? this.scope.$$phase;
    if (!phase) {
      this.scope.$digest();
      return;
    }
    // Durante un `$digest` (un watcher, `$doCheck`) no se puede anidar otro:
    // `$rootScope:inprog`, y el digest en curso ya recorre este scope.
    if (phase !== "$apply") return;
    // `$apply`: corre un handler (`ng-click`, `$apply(fn)`) y el digest todavía
    // no arrancó — lo mismo que un evento en Angular, donde `detectChanges()`
    // es síncrono (p.ej. meter un template en el DOM para medirlo antes de una
    // animación). La fase se libera solo mientras dura este `$digest`.
    root.$$phase = null;
    try {
      this.scope.$digest();
    } finally {
      root.$$phase = phase;
    }
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
