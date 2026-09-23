import angular from "angular";
import {
  decorateControllerAsyncPipe,
  decorateControllerChangeDetectorRef,
  decorateControllerContentProjection,
  decorateControllerControlValueAccessor,
  decorateControllerDestroyRef,
  decorateControllerElementRef,
  decorateControllerHostDirectives,
  decorateControllerInjectionContext,
  decorateControllerInputDefer,
  decorateControllerNgValidators,
  decorateControllerOutputEmitters,
  decorateControllerViewChildQueries,
  decorateControllerViewContainerRef,
  decorateFormGroupDirective,
  decorateNgDisabledDirective,
  decorateNgRefDirective,
} from "@/native/bridges/index.ts";

/** Módulo AngularJS donde se registran los bridges que siguen siendo runtime. */
export const NativeModule: angular.IModule = angular
  .module("ng.js.native", [])
  .decorator("$controller", decorateControllerInjectionContext)
  .decorator("$controller", decorateControllerElementRef)
  .decorator("$controller", decorateControllerChangeDetectorRef)
  .decorator("$controller", decorateControllerViewContainerRef)
  .decorator("$controller", decorateControllerInputDefer)
  .decorator("$controller", decorateControllerViewChildQueries)
  .decorator("$controller", decorateControllerContentProjection)
  .decorator("$controller", decorateControllerAsyncPipe)
  .decorator("$controller", decorateControllerDestroyRef)
  .decorator("$controller", decorateControllerOutputEmitters)
  .decorator("$controller", decorateControllerControlValueAccessor)
  .decorator("$controller", decorateControllerNgValidators)
  .decorator("$controller", decorateControllerHostDirectives)
  .decorator("ngDisabledDirective", decorateNgDisabledDirective)
  .decorator("ngRefDirective", decorateNgRefDirective);
NativeModule.decorator("formGroupDirective", decorateFormGroupDirective);
