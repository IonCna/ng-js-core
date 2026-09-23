/**
 * `ngjs-core/runtime/animations` — el `angular.module` que enciende las
 * animaciones en el modo sin-CLI: carga `ngAnimate` y bindea el token
 * `AnimationBuilder` a la implementación sobre `$animateCss`.
 *
 * Equivale a poner `BrowserAnimationsModule` / `provideAnimations()` en un
 * `bootstrapApplication` de Angular. La sintaxis de template (`[@trigger]`,
 * `(@t.done)`, `:enter`/`:leave`) NO está acá — la agrega el CLI; core-only usa
 * las clases `.ng-enter`/`.ng-leave` nativas de `ngAnimate`.
 */
import angular from "angular";
import "angular-animate";
import { AnimationBuilder, BrowserAnimationBuilder, NoopAnimationBuilder } from "@/animations/animation-builder.ts";
import { installCoreModule } from "@/runtime/core-module.ts";

// Superficie de clase (`@angular/animations`): la DSL `trigger`/`state`/`animate`/…,
// `AnimationBuilder`/`AnimationPlayer` y los tipos de metadata. Sin side-effects.
export * from "@/animations/index.ts";

/** Nombre del módulo AngularJS de `angular-animate`. */
const NG_ANIMATE = "ngAnimate";

let browserMod: angular.IModule | undefined;
let noopMod: angular.IModule | undefined;

/**
 * `angular.module("ng.js.animations")` — depende de `ngAnimate` y registra
 * `AnimationBuilder` → `BrowserAnimationBuilder` (que inyecta `$animateCss`).
 * Memoizado. Un `@NgModule` de runtime lo pone en `imports:`.
 */
export function browserAnimationsModule(): angular.IModule {
  if (browserMod) return browserMod;
  installCoreModule();
  browserMod = angular
    .module("ng.js.animations", ["ng.js.core", NG_ANIMATE])
    .service(AnimationBuilder.$name, BrowserAnimationBuilder);
  return browserMod;
}

/**
 * `angular.module("ng.js.animations.noop")` — carga `ngAnimate` pero lo apaga
 * (`$animate.enabled(false)`, en un `.run()`) y bindea el builder no-op. Mismo
 * efecto que `NoopAnimationsModule` de Angular: la DSL y `AnimationBuilder`
 * siguen usables, pero nada anima (útil en tests / e2e).
 */
export function noopAnimationsModule(): angular.IModule {
  if (noopMod) return noopMod;
  installCoreModule();

  const disableAnimations = ($animate: angular.animate.IAnimateService) => {
    $animate.enabled(false);
  };
  disableAnimations.$inject = ["$animate"];

  noopMod = angular
    .module("ng.js.animations.noop", ["ng.js.core", NG_ANIMATE])
    .service(AnimationBuilder.$name, NoopAnimationBuilder)
    .run(disableAnimations);
  return noopMod;
}

/** `angular.IModule` listo para `@NgModule({ imports: [BrowserAnimationsModule] })`. */
export const BrowserAnimationsModule: angular.IModule = browserAnimationsModule();

/** `angular.IModule` listo para `@NgModule({ imports: [NoopAnimationsModule] })`. */
export const NoopAnimationsModule: angular.IModule = noopAnimationsModule();

/**
 * Equivalente funcional de `provideAnimations()` de `@angular/platform-browser`.
 * Acá el destino es `@NgModule({ imports: [...] })` (que acepta `angular.IModule`),
 * no `providers:` — devuelve el mismo módulo que `BrowserAnimationsModule`.
 */
export function provideAnimations(): angular.IModule {
  return browserAnimationsModule();
}

/** Equivalente funcional de `provideNoopAnimations()`. */
export function provideNoopAnimations(): angular.IModule {
  return noopAnimationsModule();
}
