import { InjectionToken } from "@/core/di/injection-token.ts";

/**
 * Mismo token que `@angular/core`. En Angular real distingue `'browser'` /
 * `'server'` para el código SSR-aware. `ngjs-core` corre siempre en un
 * navegador (AngularJS necesita el DOM), así que el factory devuelve siempre
 * `'browser'`. Se expone para que el código portado de `ng-bootstrap` que hace
 * `inject(PLATFORM_ID)` + `isPlatformBrowser(...)` compile y se comporte igual
 * (la rama browser).
 */
export const PLATFORM_ID = new InjectionToken<string>("PLATFORM_ID", {
  factory: () => "browser",
});
