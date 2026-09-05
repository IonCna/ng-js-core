import { NgContainer } from "@/common/ng-container.ts";
import { NgContent } from "@/common/ng-content.ts";
import { NgTemplateOutlet } from "@/common/ng-template-outlet.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { TemplateRef } from "@/core/refs/template-ref.ts";

/**
 * `CommonModule` — `@NgModule` que **solo estampa** (modo con CLI). `imports`
 * referencia `"ng.js.core"` por nombre (string), no la clase, para no arrastrar
 * el motor de runtime. En el modo sin CLI se usa el `angular.module` imperativo
 * de `ngjs-core/runtime/common` (`commonModule()`), no esta clase.
 */
@NgModule({
  id: "ng.js.common",
  imports: ["ng.js.core"],
  declarations: [NgContent, NgContainer, NgTemplateOutlet, TemplateRef],
})
export class CommonModule {}
