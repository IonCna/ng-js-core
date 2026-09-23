import type { Provider } from "@/core/di/provider.ts";

/** Opciones aceptadas por `@Component` y leídas por `ng-js-compiler`. */
export interface ComponentDef {
  selector: string;
  template?: string;
  templateUrl?: string;
  styleUrl?: string;
  providers?: Provider[];
  exportAs?: string;
  controllerAs?: string;
  hostDirectives?: HostDirectiveDef[];
}

/** Opciones aceptadas por `@Directive` y leídas por `ng-js-compiler`. */
export interface DirectiveDef {
  /** Se omite en una directiva abstracta usada como clase base. */
  selector?: string;
  template?: string;
  templateUrl?: string;
  providers?: Provider[];
  exportAs?: string;
  controllerAs?: string;
  hostDirectives?: HostDirectiveDef[];
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
  imports?: (Function | { name: string } | string)[];
  providers?: Provider[];
  bootstrap?: Function[];
  controllerAs?: string;
}
