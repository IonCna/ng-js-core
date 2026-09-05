import type angular from "angular";
import { ChangeDetectorRef, ChangeDetectorRefImpl } from "@/core/change-detection/change-detector-ref.ts";
import { decorateControllerWith } from "@/runtime/bridges/shared.ts";

export function decorateControllerChangeDetectorRef($delegate: angular.IControllerService): angular.IControllerService {
  return decorateControllerWith($delegate, {
    augmentLocals: (locals) => {
      const $scope = locals?.$scope as angular.IScope | undefined;
      if (!$scope || (locals && Object.hasOwn(locals, ChangeDetectorRef.$name))) return locals;

      return { ...locals, [ChangeDetectorRef.$name]: new ChangeDetectorRefImpl($scope) };
    },
  });
}
decorateControllerChangeDetectorRef.$inject = ["$delegate"];
