/**
 * `ngjs-core/runtime/common` — las 4 directivas estructurales **peladas**
 * (`angular.IDirective` a mano, sin `@Directive`) más el `angular.module`
 * (`ng.js.common`) que las registra imperativamente.
 *
 * `ng.js.common` también registra los servicios de `@angular/common` que no
 * dependen de una `LocationStrategy` concreta: `DOCUMENT`, `PlatformLocation`
 * (→ `BrowserPlatformLocation`), `Location`, `APP_BASE_HREF` (default `"/"`) y
 * `ViewportScroller`. `LocationStrategy` la elige `RouterModule.forRoot`
 * (`Path` por default, `withHashLocation()` → `Hash`), así que `Location` solo
 * resuelve con el router presente — igual que en Angular.
 *
 * Se importa esto en el modo runtime (`ngjs-core/runtime/*`); el modo con CLI
 * usa `ngjs-core/common` (clases `@Directive` que solo estampan). Nunca los dos.
 */
import angular from "angular";
import {
  APP_BASE_HREF,
  BrowserPlatformLocation,
  Location,
  LocationImpl,
  PlatformLocation,
} from "@/common/location/index.ts";
import { BrowserViewportScroller, ViewportScroller } from "@/common/viewport-scroller.ts";
import { DOCUMENT } from "@/core/dom-tokens.ts";
import { TemplateRef } from "@/core/refs/template-ref.ts";
import { NgContainer } from "@/runtime/common/ng-container.ts";
import { NgContent } from "@/runtime/common/ng-content.ts";
import { NgTemplateOutlet } from "@/runtime/common/ng-template-outlet.ts";
import { installCoreModule } from "@/runtime/core-module.ts";

export * from "@/common/location/index.ts";
export { isPlatformBrowser, isPlatformServer } from "@/common/platform.ts";
export { BrowserViewportScroller, ViewportScroller } from "@/common/viewport-scroller.ts";
export { DOCUMENT } from "@/core/dom-tokens.ts";
export { AsyncPipe } from "@/pipes/async-pipe.ts";
export type { KeyValue } from "@/pipes/key-value.ts";
export { NgContainer } from "@/runtime/common/ng-container.ts";
export { NgContent } from "@/runtime/common/ng-content.ts";
export { NgTemplateOutlet } from "@/runtime/common/ng-template-outlet.ts";

let mod: angular.IModule | undefined;

/**
 * `angular.module("ng.js.common")` con las 4 directivas peladas + `TemplateRef`
 * (`ng-template`) + los servicios de plataforma de `@angular/common`. Memoizado.
 * Un `@NgModule` de runtime lo pone en `imports:` (lo acepta como `angular.IModule`).
 */
export function commonModule(): angular.IModule {
  if (mod) return mod;
  installCoreModule();
  mod = angular
    .module("ng.js.common", ["ng.js.core"])
    .directive("ngContent", NgContent.$factory)
    .directive("ngContainer", NgContainer.$factory)
    .directive("ngTemplate", TemplateRef.$factory)
    .directive("ngTemplateOutlet", NgTemplateOutlet.$factory)
    .factory(DOCUMENT.toString(), ["$document", ($document: angular.IDocumentService) => $document[0]])
    .value(APP_BASE_HREF.toString(), "/")
    .service(PlatformLocation.$name, BrowserPlatformLocation)
    .service(Location.$name, LocationImpl)
    .service(ViewportScroller.$name, BrowserViewportScroller);
  return mod;
}

/** El `angular.module` de `ng.js.common`, listo para `@NgModule({ imports: [CommonModule] })`. */
export const CommonModule: angular.IModule = commonModule();
