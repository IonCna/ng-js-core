import type angular from "angular";
import { AsyncPipe, AsyncPipeImpl } from "@/pipes/async-pipe.ts";
import { decorateControllerWith } from "@/runtime/bridges/shared.ts";

/**
 * Agrega `AsyncPipe` a `locals` antes de instanciar — mismo mecanismo que
 * `element-ref-bridge.ts` (por-instancia, `augmentLocals`, no un `.service()`
 * de AngularJS): cada controller recibe su PROPIA instancia, ya resuelta
 * contra su `$scope`, así que se limpia sola en `$destroy` sin que nadie
 * tenga que pasarle nada a mano.
 */
export function decorateControllerAsyncPipe($delegate: angular.IControllerService): angular.IControllerService {
  return decorateControllerWith($delegate, {
    augmentLocals: (locals) => {
      const $scope = locals?.$scope as angular.IScope | undefined;
      if (!$scope || (locals && Object.hasOwn(locals, AsyncPipe.$name))) return locals;

      return { ...locals, [AsyncPipe.$name]: new AsyncPipeImpl($scope) };
    },
  });
}
decorateControllerAsyncPipe.$inject = ["$delegate"];
