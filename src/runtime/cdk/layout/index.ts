/**
 * `ngjs-core/runtime/cdk/layout` — el `angular.module` que registra los servicios
 * de `@angular/cdk/layout` (`MediaMatcher`, `BreakpointObserver`). `Breakpoints`
 * es una const, no va por DI. Sin dependencias externas — `window.matchMedia`.
 * **Opt-in**.
 */
import angular from "angular";
import { BreakpointObserver, BreakpointObserverImpl } from "@/cdk/layout/breakpoint-observer.ts";
import { MediaMatcher, MediaMatcherImpl } from "@/cdk/layout/media-matcher.ts";
import { installCoreModule } from "@/runtime/core-module.ts";

export * from "@/cdk/layout/index.ts";

let base: angular.IModule | undefined;

/** `angular.module("ng.js.cdk.layout")` memoizado. */
export function layoutModule(): angular.IModule {
  if (base) return base;
  installCoreModule();

  base = angular
    .module("ng.js.cdk.layout", ["ng.js.core"])
    .service(MediaMatcher.$name, MediaMatcherImpl)
    .service(BreakpointObserver.$name, BreakpointObserverImpl);

  return base;
}

/** `angular.IModule` listo para `@NgModule({ imports: [LayoutModule] })`. */
export const LayoutModule: angular.IModule = layoutModule();

/** Equivalente funcional. */
export function provideLayout(): angular.IModule {
  return layoutModule();
}
