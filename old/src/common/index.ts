// `DOCUMENT` vive en `@angular/core` desde Angular 20; `@angular/common` lo
// re-exporta (deprecado). `ngjs-core/common` hace lo mismo.
export { DOCUMENT } from "@/core/dom-tokens.ts";
export { AsyncPipe } from "@/pipes/async-pipe.ts";
export type { KeyValue } from "@/pipes/key-value.ts";
export { CommonModule } from "./common-module.ts";
export * from "./location/index.ts";
export { NgContainer } from "./ng-container.ts";
export { NgContent } from "./ng-content.ts";
export { NgTemplateOutlet } from "./ng-template-outlet.ts";
export { isPlatformBrowser, isPlatformServer } from "./platform.ts";
export { BrowserViewportScroller, ViewportScroller } from "./viewport-scroller.ts";
