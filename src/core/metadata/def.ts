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
}
