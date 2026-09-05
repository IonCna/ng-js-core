import type angular from "angular";
import { decorateControllerWith } from "@/runtime/bridges/shared.ts";
import { DestroyRef, DestroyRefImpl } from "@/rxjs-interop/destroy-ref.ts";

/** Agrega `DestroyRef` a `locals` antes de instanciar — mismo mecanismo que `element-ref-bridge.ts`/`async-pipe-bridge.ts` (por-instancia, `augmentLocals`). */
export function decorateControllerDestroyRef($delegate: angular.IControllerService): angular.IControllerService {
  return decorateControllerWith($delegate, {
    augmentLocals: (locals) => {
      const $scope = locals?.$scope as angular.IScope | undefined;
      if (!$scope || (locals && Object.hasOwn(locals, DestroyRef.$name))) return locals;

      return { ...locals, [DestroyRef.$name]: new DestroyRefImpl($scope) };
    },
  });
}
decorateControllerDestroyRef.$inject = ["$delegate"];
