export { ComponentRef } from "./component-ref.ts";
export { type CreateComponentOptions, createComponent } from "./create-component.ts";
// `DestroyRef` es `@angular/core` (no `@angular/core/rxjs-interop`); `DestroyRefImpl`
// queda como detalle de `destroy-ref-bridge.ts` y no se re-exporta.
export { DestroyRef } from "./destroy-ref.ts";
export { ElementRef } from "./element-ref.ts";
export type { ContextObject } from "./embedded-view-ref.ts";
export { EmbeddedViewRef } from "./embedded-view-ref.ts";
export { TemplateRef } from "./template-ref.ts";
export { ViewContainerRef } from "./view-container-ref.ts";
export { ViewRef } from "./view-ref.ts";
