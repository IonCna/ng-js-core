import angular from "angular";
import { installCoreModule } from "@/runtime/core-module.ts";
import { FormArrayNameDirective } from "@/runtime/forms/form-array-name-directive.ts";
import { FormControlNameDirective } from "@/runtime/forms/form-control-name-directive.ts";
import { FormGroupDirective } from "@/runtime/forms/form-group-directive.ts";

export { FormArrayNameDirective } from "@/runtime/forms/form-array-name-directive.ts";
export { FormControlNameDirective } from "@/runtime/forms/form-control-name-directive.ts";
export { FormGroupDirective } from "@/runtime/forms/form-group-directive.ts";

let mod: angular.IModule | undefined;

/**
 * `angular.module("ng.js.forms")` con las directivas de forms reactivos
 * (`[formGroup]` / `formControlName` / `formArrayName`). Memoizado, mismo
 * patrón que `commonModule()` (`runtime/common/index.ts`). `NG_VALUE_ACCESSOR`
 * / `NG_VALIDATORS` NO viven acá — esos bridges son generales (aplican a
 * cualquier `ngModel`, no solo a árboles reactivos) y ya están en
 * `installCoreModule()`.
 */
export function formsModule(): angular.IModule {
  if (mod) return mod;
  installCoreModule();
  mod = angular
    .module("ng.js.forms", ["ng.js.core"])
    .directive("formGroup", FormGroupDirective.$factory)
    .directive("formControlName", FormControlNameDirective.$factory)
    .directive("formArrayName", FormArrayNameDirective.$factory);
  return mod;
}
