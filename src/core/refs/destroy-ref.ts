import type angular from "angular";
import { Subject } from "rxjs";
import { Injectable } from "@/core/di/injectable.ts";

/**
 * Se inyecta por-instancia (mismo mecanismo que `ElementRef`/`AsyncPipe`, ver `destroy-ref-bridge.ts`). Un
 * `inject(DestroyRef)` durante la construcción lo reemplaza el compilador por el valor de los `locals` del
 * controller, así que `takeUntilDestroyed()` sin argumento funciona en un inicializador de campo, como en Angular.
 */
@Injectable()
export abstract class DestroyRef {
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
