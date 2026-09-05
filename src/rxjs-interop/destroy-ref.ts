import type angular from "angular";
import { Subject } from "rxjs";

/**
 * Se inyecta por-instancia (mismo mecanismo que `ElementRef`/`AsyncPipe`, ver
 * `destroy-ref-bridge.ts`) — no hay contexto de inyección ambiental acá como
 * en Angular real (`inject(DestroyRef)` sin argumentos no existe), así que
 * `takeUntilDestroyed()` recibe el `DestroyRef` siempre explícito, nunca lo
 * resuelve solo.
 */
export abstract class DestroyRef {
  static readonly $name = "DestroyRef";

  abstract onDestroy(callback: () => void): () => void;
}

export class DestroyRefImpl extends DestroyRef {
  // ya tenemos RxJS — un Subject resuelve "avisar ahora, y si ya pasó, avisar
  // igual al toque" solo: al completarse, cualquier subscribe() posterior
  // recibe `complete()` sincrónico (confirmado leyendo Subject._innerSubscribe/
  // _checkFinalizedStatuses en rxjs), sin necesitar banderas ni Set a mano.
  private readonly destroyed$ = new Subject<void>();

  constructor($scope: angular.IScope) {
    super();
    $scope.$on("$destroy", () => {
      this.destroyed$.next();
      this.destroyed$.complete();
    });
  }

  onDestroy(callback: () => void): () => void {
    const subscription = this.destroyed$.subscribe({ complete: callback });
    return () => subscription.unsubscribe();
  }
}
