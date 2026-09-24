import { CommonModule } from "@/common/common.module.ts";
import { CoreModule } from "@/core/core.module.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { RendererFactory2 } from "@/core/render/renderer.ts";
import { Meta, MetaImpl } from "@/platform-browser/meta.ts";
import { RendererFactory2Impl } from "@/platform-browser/renderer.ts";
import { DomSanitizer, DomSanitizerImpl } from "@/platform-browser/security/dom-sanitizer.ts";
import { Title, TitleImpl } from "@/platform-browser/title.ts";

/**
 * `BrowserModule` de `@angular/platform-browser`: lo importa el `@NgModule` raíz. Trae `CommonModule`, los bridges
 * de `ngjs-core` (`CoreModule`) y los servicios del navegador (`Title`, `Meta`, `DomSanitizer`, `RendererFactory2`).
 */
@NgModule({
  imports: [CoreModule, CommonModule],
  providers: [
    { provide: Title, useClass: TitleImpl },
    { provide: Meta, useClass: MetaImpl },
    { provide: DomSanitizer, useClass: DomSanitizerImpl },
    { provide: RendererFactory2, useClass: RendererFactory2Impl },
  ],
})
export class BrowserModule {}

/** Nombre anterior de `BrowserModule`. */
export const PlatformBrowserModule = BrowserModule;
