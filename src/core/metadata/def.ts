import type angular from "angular";
import type { Provider } from "@/core/di/provider.ts";

/**
 * `ComponentDef` (y el resto de los `*Def`) es data plana, sin lógica — el
 * registro normalizado al que convergen los distintos frentes de autoría
 * (JS `component()`, TS `@Component`). Ver CONCEPTOS "Un modelo de datos,
 * varios frentes".
 */

export interface InputDef {
  propName: string;
  bindingName: string;
  /**
   * `true` → binding sin `?` (`'<'`) + assert de presencia, como `@Input({ required: true })`.
   * Ausente/`false` → binding opcional (`'<?'`), que es el default de Angular.
   */
  required?: boolean;
  transform?: (value: unknown) => unknown;
  /** `true` → binding `'='` de AngularJS (two-way nativo) en vez de `'<'`. Viene de `model()`/`@Model`. */
  twoWay?: boolean;
  /** Modo de binding explícito: `'@'` = string literal/interpolación; `'<'` = expresión (default). */
  binding?: "<" | "@";
}

export interface OutputDef {
  propName: string;
  bindingName: string;
}

export interface HostBindingDef {
  propName: string;
  hostProperty: string;
}

export interface HostListenerDef {
  methodName: string;
  eventName: string;
  args?: string[];
}

export interface HostDef {
  bindings?: HostBindingDef[];
  listeners?: HostListenerDef[];
}

/**
 * `hostDirectives` de Angular 15+: componer otra directiva sobre el mismo host
 * (sus `@HostBinding`/`@HostListener`/ciclo de vida corren en este elemento, y
 * queda `inject()`-able desde el host). Forma corta `[MiDir]` o larga
 * `{ directive: MiDir, inputs: [...], outputs: [...] }`.
 *
 * Lo cablea `host-directives-bridge.ts` (decorador de `$controller`): instancia
 * cada directiva compuesta sobre el `$element` del host antes de construirlo.
 * Todavía NO reenvía `inputs`/`outputs` de la forma larga.
 */
export type HostDirectiveDef =
  | Function
  | {
      directive: Function;
      inputs?: string[];
      outputs?: string[];
    };

export interface ComponentDef {
  selector: string;
  host?: HostDef;
  providers?: Provider[];
  template?: string;
  templateUrl?: string;
  bindings?: Record<string, string>;
  transclude?: boolean | Record<string, string>;
  controllerAs?: string;
  require?: Record<string, string>;
  styles?: string | string[];
  styleUrl?: string;
  exportAs?: string;
  /** Ver `HostDirectiveDef` — lo cablea `host-directives-bridge.ts`. */
  hostDirectives?: HostDirectiveDef[];
  // queries[] / lifecycle quedan afuera hasta etapas 5/7
}

export interface DirectiveDef {
  selector: string;
  host?: HostDef;
  providers?: Provider[];
  exportAs?: string;
  restrict?: string;
  scope?: boolean | Record<string, string>;
  bindToController?: boolean | Record<string, string>;
  require?: string | string[] | Record<string, string>;
  transclude?: boolean | "element" | Record<string, string>;
  template?: string;
  templateUrl?: string;
  controllerAs?: string;
  priority?: number;
  terminal?: boolean;
  compile?: angular.IDirectiveCompileFn;
  link?: angular.IDirectiveLinkFn | angular.IDirectivePrePost;
  /** Ver `HostDirectiveDef` — lo cablea `host-directives-bridge.ts`. */
  hostDirectives?: HostDirectiveDef[];
}

export interface PipeDef {
  name: string;
  /** Como en Angular real: `true` por default — ver CONCEPTOS "pipe puro vs impuro". */
  pure?: boolean;
}

export interface NgModuleDef {
  /**
   * Nombre del `angular.module` que representa a esta clase. Opcional: si falta,
   * se deriva de `Clase.name` (con contador de desempate). Declararlo solo cuando
   * hace falta un nombre estable y conocido (tests con `angular.mock.module("...")`,
   * interop con un `angular.module` escrito a mano).
   */
  id?: string;
  declarations?: Function[];
  imports?: (Function | angular.IModule | string)[];
  providers?: Provider[];
  /**
   * Componentes raíz (`@Component` con selector de elemento). Al arrancar con
   * `bootstrapApplication(AppModule)`, por cada uno se crea su elemento dentro del
   * host (default `<body>`) si no está ya en el DOM, y AngularJS lo compila.
   * Equivale a `@NgModule({ bootstrap: [...] })` de Angular. No hace falta
   * repetirlos en `declarations`: se auto-declaran.
   */
  bootstrap?: Function[];
  /**
   * `controllerAs` por default para las `declarations` de este módulo que no lo
   * declaren en su `@Component`/`@Directive`. Se hereda hacia los `@NgModule`
   * importados que tampoco lo pongan (gana el más cercano). Sin nada en ningún
   * nivel: `"$ctrl"` (el default nativo de AngularJS).
   */
  controllerAs?: string;
}
