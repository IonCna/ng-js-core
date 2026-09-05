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
}

export interface PipeDef {
  name: string;
  /** Como en Angular real: `true` por default — ver CONCEPTOS "pipe puro vs impuro". */
  pure?: boolean;
}

export interface NgModuleDef {
  declarations?: Function[];
  imports?: Function[];
  providers?: Provider[];
  bootstrap?: Function[];
}
