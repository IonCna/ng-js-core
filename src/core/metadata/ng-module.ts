import type { NgModuleDef } from "@/core/metadata/definitions.ts";

export type { NgModuleDef } from "@/core/metadata/definitions.ts";

/**
 * Decorador de autoría para `@NgModule`.
 *
 * `ApplicationScanner` y `ModuleWriter` leen esta definición durante el build
 * y generan `ɵmod`, los imports y el registro del módulo AngularJS. No se crea
 * `angular.module()` al evaluar el decorador.
 */
export function NgModule(_def: NgModuleDef): ClassDecorator {
  return (target) => target;
}
