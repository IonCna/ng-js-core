import type angular from "angular";
import type { Provider } from "@/core/di/provider.ts";

export interface NgModuleDef {
  id?: string;
  declarations?: Function[];
  imports?: (Function | angular.IModule | string)[];
  providers?: Provider[];
  bootstrap?: Function[];
  controllerAs?: string;
}

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
