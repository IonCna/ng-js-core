/**
 * `ngjs-core/runtime/platform-browser` — el `angular.module` que registra los
 * servicios de plataforma (`@angular/common` / `@angular/platform-browser`).
 * Por ahora: `DOCUMENT`, `Title`, `Meta`, `PlatformLocation` + `APP_BASE_HREF`,
 * `Location`, `ViewportScroller`. `LocationStrategy` NO se registra acá (como en
 * Angular: sin default en `common`) — lo provee `RouterModule.forRoot` (`Path`
 * por default, `withHashLocation()` → `Hash`), por eso `Location` solo resuelve
 * con el router presente. Falta `DomSanitizer`. **Opt-in** — no se carga solo.
 */
import angular from "angular";
import { DOCUMENT } from "@/platform-browser/dom-tokens.ts";
import {
  APP_BASE_HREF,
  BrowserPlatformLocation,
  Location,
  LocationImpl,
  PlatformLocation,
} from "@/platform-browser/location/index.ts";
import { Meta, MetaImpl } from "@/platform-browser/meta.ts";
import { Title, TitleImpl } from "@/platform-browser/title.ts";
import { BrowserViewportScroller, ViewportScroller } from "@/platform-browser/viewport-scroller.ts";
import { installCoreModule } from "@/runtime/core-module.ts";

export * from "@/platform-browser/index.ts";

let base: angular.IModule | undefined;

/** `angular.module("ng.js.platform-browser")` memoizado. */
export function platformBrowserModule(): angular.IModule {
  if (base) return base;
  installCoreModule();

  base = angular
    .module("ng.js.platform-browser", ["ng.js.core"])
    .factory(DOCUMENT.toString(), ["$document", ($document: angular.IDocumentService) => $document[0]])
    .service(Title.$name, TitleImpl)
    .service(Meta.$name, MetaImpl)
    .value(APP_BASE_HREF.toString(), "/")
    .service(PlatformLocation.$name, BrowserPlatformLocation)
    .service(Location.$name, LocationImpl)
    .service(ViewportScroller.$name, BrowserViewportScroller);

  return base;
}

/** `angular.IModule` listo para `@NgModule({ imports: [PlatformBrowserModule] })`. */
export const PlatformBrowserModule: angular.IModule = platformBrowserModule();

/** Equivalente funcional. */
export function providePlatformBrowser(): angular.IModule {
  return platformBrowserModule();
}
