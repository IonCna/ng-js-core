/**
 * `ngjs-core/runtime/platform-browser` — el `angular.module` que registra los
 * servicios propios de `@angular/platform-browser`: `Title`, `Meta`, `DomSanitizer`,
 * `RendererFactory2`.
 *
 * `DOCUMENT`, `PlatformLocation` + `APP_BASE_HREF`, `Location` y `ViewportScroller`
 * son `@angular/common`: los registra `ng.js.common`, del que este módulo depende
 * (como `BrowserModule` re-exporta `CommonModule` en Angular). `LocationStrategy`
 * NO tiene default acá — lo provee `RouterModule.forRoot`. **Opt-in** — no se
 * carga solo.
 */
import angular from "angular";
import { RendererFactory2 } from "@/core/render/renderer.ts";
import { Meta, MetaImpl } from "@/platform-browser/meta.ts";
import { RendererFactory2Impl } from "@/platform-browser/renderer.ts";
import { DomSanitizer, DomSanitizerImpl } from "@/platform-browser/security/index.ts";
import { Title, TitleImpl } from "@/platform-browser/title.ts";
import { commonModule } from "@/runtime/common/index.ts";
import { installCoreModule } from "@/runtime/core-module.ts";

export * from "@/platform-browser/index.ts";

let base: angular.IModule | undefined;

/** `angular.module("ng.js.platform-browser")` memoizado. */
export function platformBrowserModule(): angular.IModule {
  if (base) return base;
  installCoreModule();
  commonModule();

  base = angular
    .module("ng.js.platform-browser", ["ng.js.core", "ng.js.common"])
    .service(Title.$name, TitleImpl)
    .service(Meta.$name, MetaImpl)
    .service(DomSanitizer.$name, DomSanitizerImpl)
    .service(RendererFactory2.$name, RendererFactory2Impl);

  return base;
}

/** `angular.IModule` listo para `@NgModule({ imports: [PlatformBrowserModule] })`. */
export const PlatformBrowserModule: angular.IModule = platformBrowserModule();

/** Equivalente funcional. */
export function providePlatformBrowser(): angular.IModule {
  return platformBrowserModule();
}
