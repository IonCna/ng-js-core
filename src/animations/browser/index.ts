/**
 * `ngjs-core/animations/browser` — superficie de `@angular/animations/browser`:
 * el token `AnimationDriver` y los drivers que trae el core. Un driver propio
 * (p. ej. sobre otra librería de animación) se provee con
 * `{ provide: AnimationDriver, useClass: MiDriver }`.
 */

export { AnimationDriver, ɵAnimateCssDriver, ɵNoopAnimationDriver } from "@/animations/browser/animation-driver.ts";
