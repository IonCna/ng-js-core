import { InjectionToken } from "@/core/di/injection-token.ts";

/**
 * `DOCUMENT` — mismo token que `@angular/common`. Al inyectarlo se obtiene el
 * `Document` del navegador. Lo provee `PlatformBrowserModule` como `.factory`
 * sobre `$document` de AngularJS (`$document[0]` es el `document` global que
 * jqLite envuelve en un array-like). Inyectá con `inject(DOCUMENT)` o
 * `@Inject(DOCUMENT)`.
 */
export const DOCUMENT = new InjectionToken<Document>("DOCUMENT");
