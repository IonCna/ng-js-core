import { InjectionToken } from "@/core/di/injection-token.ts";

/**
 * `DOCUMENT` — vive en `@angular/core` desde Angular 20 (antes en `@angular/common`,
 * que hoy lo re-exporta deprecado); `ngjs-core` hace lo mismo (`ngjs-core/common`
 * lo re-exporta). Al inyectarlo se obtiene el `Document` del navegador: el token se
 * provee solo (`factory`, `providedIn: "root"`). Inyectá con `inject(DOCUMENT)` o
 * `@Inject(DOCUMENT)`.
 */
export const DOCUMENT = new InjectionToken<Document>("DOCUMENT", { factory: () => document });
