import type angular from "angular";
import type { Provider } from "@/core/di/provider.ts";
import type { Type } from "@/core/di/provider-token.ts";
import type { InputTransform } from "@/core/metadata/input.ts";
import type { Query } from "@/core/queries/query-types.ts";

/**
 * Un input declarado en el decorador (`inputs: [...]`), como Angular 16: `"propiedad"`, `"propiedad: alias"` o la
 * forma objeto de 16.1 (`{ name, alias, required, transform }`).
 */
export type DirectiveInput =
  | string
  | {
      name: string;
      alias?: string;
      required?: boolean;
      transform?: InputTransform;
    };

/**
 * `host` del decorador, como Angular: `"[propiedad]": "expresión"` (como `@HostBinding`), `"(evento)": "sentencia"`
 * (como `@HostListener`, con `$event`) y `"atributo": "valor"` (atributo estático del host, `class`/`style` se suman).
 */
export type HostMetadata = Record<string, string>;

/**
 * `queries` del decorador: `{ propiedad: new ViewChild(...) }` — lo mismo que el decorador sobre la propiedad. Sin
 * forma propia en runtime: el compilador lo lee y lo saca.
 */
export type QueriesMetadata = Record<string, Query>;

/** Opciones que comparten `@Directive` y `@Component` (leídas por `ng-js-compiler`). */
interface DirectiveOptions {
  providers?: Provider[];
  exportAs?: string;
  inputs?: DirectiveInput[];
  outputs?: string[];
  host?: HostMetadata;
  queries?: QueriesMetadata;
  hostDirectives?: HostDirectiveDef[];
  /** Propio de ngjs (sin equivalente en Angular): el alias del controller en el template de AngularJS. */
  controllerAs?: string;
}

/** Opciones aceptadas por `@Component` y leídas por `ng-js-compiler`. */
export interface ComponentDef extends DirectiveOptions {
  selector: string;
  template?: string;
  templateUrl?: string;
  /** CSS del componente, escopeado a su template (`ng-js-vite`). */
  styles?: string | string[];
  styleUrls?: string[];
  /** La forma de un solo archivo (Angular 17+); en 16.2 es `styleUrls`. */
  styleUrl?: string;
  /** Van al injector del elemento, como `providers` (en Angular no los ve el contenido proyectado). */
  viewProviders?: Provider[];
}

/** Opciones aceptadas por `@Directive` y leídas por `ng-js-compiler`. */
export interface DirectiveDef extends DirectiveOptions {
  /** Se omite en una directiva abstracta usada como clase base. */
  selector?: string;
  template?: string;
  templateUrl?: string;
}

/** Composición de directivas soportada por `hostDirectives`. */
export type HostDirectiveDef =
  | Function
  | {
      directive: Function;
      inputs?: string[];
      outputs?: string[];
    };

/** Opciones aceptadas por `@Pipe` y leídas por `ng-js-compiler`. */
export interface PipeDef {
  name: string;
  pure?: boolean;
}

/** Opciones aceptadas por `@NgModule` y leídas por `ng-js-compiler`. */
export interface NgModuleDef {
  declarations?: Function[];
  imports?: (Function | ModuleWithProviders<unknown> | angular.IModule | { name: string } | string | unknown[])[];
  providers?: Provider[];
  bootstrap?: Function[];
  /** Un `@NgModule` exportado llega a quien importa este; las declaraciones ya son globales en AngularJS. */
  exports?: (Function | unknown[])[];
  controllerAs?: string;
}

/** Lo que devuelve un `forRoot()`/`forChild()`: el módulo más providers extra, como Angular. */
export interface ModuleWithProviders<T> {
  ngModule: Type<T>;
  providers?: Provider[];
}
