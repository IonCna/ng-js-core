/**
 * `ngjs-core/runtime/common` — las 4 directivas estructurales **peladas**
 * (`angular.IDirective` a mano, sin `@Directive`) más el `angular.module`
 * (`ng.js.common`) que las registra imperativamente.
 *
 * Se importa esto en el modo runtime (`ngjs-core/runtime/*`); el modo con CLI
 * usa `ngjs-core/common` (clases `@Directive` que solo estampan). Nunca los dos.
 */
import angular from "angular";
import { TemplateRef } from "@/core/refs/template-ref.ts";
import { NgContainer } from "@/runtime/common/ng-container.ts";
import { NgContent } from "@/runtime/common/ng-content.ts";
import { NgTemplateOutlet } from "@/runtime/common/ng-template-outlet.ts";
import { installCoreModule } from "@/runtime/core-module.ts";

export { NgContainer } from "@/runtime/common/ng-container.ts";
export { NgContent } from "@/runtime/common/ng-content.ts";
export { NgTemplateOutlet } from "@/runtime/common/ng-template-outlet.ts";

let mod: angular.IModule | undefined;

/**
 * `angular.module("ng.js.common")` con las 4 directivas peladas + `TemplateRef`
 * (`ng-template`). Memoizado. Un `@NgModule` de runtime lo pone en `imports:`
 * (lo acepta como `angular.IModule`).
 */
export function commonModule(): angular.IModule {
  if (mod) return mod;
  installCoreModule();
  mod = angular
    .module("ng.js.common", ["ng.js.core"])
    .directive("ngContent", NgContent.$factory)
    .directive("ngContainer", NgContainer.$factory)
    .directive("ngTemplate", TemplateRef.$factory)
    .directive("ngTemplateOutlet", NgTemplateOutlet.$factory);
  return mod;
}

/** El `angular.module` de `ng.js.common`, listo para `@NgModule({ imports: [CommonModule] })`. */
export const CommonModule: angular.IModule = commonModule();
