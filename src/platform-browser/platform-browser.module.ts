import { NgModule } from "@/core/metadata/ng-module.ts";
import { CommonModule } from "@/common/common.module.ts";
import { Meta, MetaImpl } from "@/platform-browser/meta.ts";
import { RendererFactory2, RendererFactory2Impl } from "@/platform-browser/renderer.ts";
import { DomSanitizer, DomSanitizerImpl } from "@/platform-browser/security/dom-sanitizer.ts";
import { Title, TitleImpl } from "@/platform-browser/title.ts";

@NgModule({
  imports: [CommonModule],
  providers: [
    { provide: Title, useClass: TitleImpl },
    { provide: Meta, useClass: MetaImpl },
    { provide: DomSanitizer, useClass: DomSanitizerImpl },
    { provide: RendererFactory2, useClass: RendererFactory2Impl },
  ],
})
export class PlatformBrowserModule {}
