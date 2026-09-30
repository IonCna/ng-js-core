export { TemplateRef } from "@/core/refs/template-ref.ts";
export { AsyncPipe } from "@/pipes/async-pipe.ts";
export { type KeyValue, KeyValuePipe } from "@/pipes/key-value.ts";
export { PercentPipe } from "@/pipes/percent.ts";
export { TitleCasePipe } from "@/pipes/title-case.ts";
export { CommonModule } from "./common.module.ts";
export * from "./location/index.ts";
export { NgContainer } from "./ng-container.ts";
export { NgContent } from "./ng-content.ts";
export { NgTemplateOutlet } from "./ng-template-outlet.ts";
export { isPlatformBrowser, isPlatformServer } from "./platform.ts";
// Como `@angular/common` 16: `DOCUMENT` y `registerLocaleData` viven acá (también en su lugar de ngjs).
export { DOCUMENT } from "@/core/dom-tokens.ts";
export { registerLocaleData } from "@/i18n/locale-data.ts";
export { BrowserViewportScroller, ViewportScroller } from "./viewport-scroller.ts";
