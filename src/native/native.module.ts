import angular from "angular";
import { NgContainer } from "@/common/ng-container.ts";
import { NgContent } from "@/common/ng-content.ts";
import { ConfigProviderFactory } from "@/core/platform/config-providers.ts";
import { TemplateRefImpl } from "@/core/refs/template-ref.ts";
import {
  decorateControllerContentProjection,
  decorateControllerControlValueAccessor,
  decorateControllerElementTokens,
  decorateControllerHostDirectives,
  decorateControllerInjectionContext,
  decorateControllerInputDefer,
  decorateControllerNgValidators,
  decorateControllerOutputEmitters,
  decorateControllerViewChildQueries,
  decorateExceptionHandler,
  decorateNgDisabledDirective,
  decorateNgRefDirective,
  SanitizeBridge,
} from "@/native/bridges/index.ts";

/**
 * El runtime de `ngjs-core` que no es una clase compilada: lo que solo se puede hacer con la API imperativa de
 * AngularJS (`.decorator()` sobre `$controller`, directivas con `transclude: "element"`/`compile`, `.config()`).
 * `platformBrowserDynamic()` lo agrega solo al módulo raíz; un `@NgModule` también lo puede importar.
 *
 * Orden de los decoradores de `$controller` (cada uno envuelve al anterior): el contexto de inyección es el más
 * interno (envuelve la construcción real), `hostDirectives` el más externo (su `$delegate` es toda la cadena).
 */
export const NativeModule: angular.IModule = angular
  .module("ng.js.native", [])
  .decorator("$controller", decorateControllerInjectionContext)
  .decorator("$controller", decorateControllerElementTokens)
  // Interno a las queries: su `resolve()` (que prependen al `$postLink`) corre antes que el replay de los inputs.
  .decorator("$controller", decorateControllerInputDefer)
  .decorator("$controller", decorateControllerViewChildQueries)
  // Después de las queries: cuando corre su `$onInit` (proyección eager) el registry del componente ya existe.
  .decorator("$controller", decorateControllerContentProjection)
  .decorator("$controller", decorateControllerOutputEmitters)
  .decorator("$controller", decorateControllerControlValueAccessor)
  .decorator("$controller", decorateControllerNgValidators)
  .decorator("$controller", decorateControllerHostDirectives)
  .decorator("ngDisabledDirective", decorateNgDisabledDirective)
  .decorator("ngRefDirective", decorateNgRefDirective)
  .decorator("$exceptionHandler", decorateExceptionHandler)
  // `ng-bind-html` sin `ngSanitize`: el sanitizador de `DomSanitizer` (ver `SanitizeBridge`).
  .factory("$sanitize", SanitizeBridge.factory)
  .directive("ngTemplate", TemplateRefImpl.directive)
  .directive("ngContent", NgContent.directive)
  .directive("ngContainer", NgContainer.directive)
  .config(ConfigProviderFactory.capture);
