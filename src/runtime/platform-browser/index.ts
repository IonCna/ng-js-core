/**
 * `ngjs-core/runtime/platform-browser` — el `angular.module` que registra los
 * servicios de plataforma (`@angular/common` / `@angular/platform-browser`).
 * Por ahora: `DOCUMENT`, `Title`. Se irá completando pieza por pieza
 * (DomSanitizer, Meta, Location, ViewportScroller, BreakpointObserver).
 * **Opt-in** — no se carga solo.
 */
import angular from "angular";
import { DOCUMENT } from "@/platform-browser/dom-tokens.ts";
import { Title, TitleImpl } from "@/platform-browser/title.ts";
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
    .service(Title.$name, TitleImpl);

  return base;
}

/** `angular.IModule` listo para `@NgModule({ imports: [PlatformBrowserModule] })`. */
export const PlatformBrowserModule: angular.IModule = platformBrowserModule();

/** Equivalente funcional. */
export function providePlatformBrowser(): angular.IModule {
  return platformBrowserModule();
}
