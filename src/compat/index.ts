/**
 * `ngjs-core/compat` — para consumidores en **JS puro** (sin build, sin `tsc`).
 * La forma funcional (`component(Foo).define({…})`) y los decoradores legacy
 * (dialecto `experimentalDecorators` / Babel `{ legacy: true }`) **auto-registran
 * al definir**: se acumulan en una cola y `compat.bootstrap()` los monta, o si ya
 * hubo bootstrap se registran en vivo con los config-providers capturados. No se
 * puede apagar. Ver `docs/CAPAS.md`.
 *
 * Se usa `ngjs-core` + CLI, `ngjs-core/runtime`, **o** `ngjs-core/compat` — uno solo.
 */

import { compatRegistry } from "@/compat/registry.ts";
import type { InjectableOptions } from "@/core/di/injectable.ts";
import { Injectable as CoreInjectableDecorator, injectable as coreInjectable } from "@/core/di/injectable.ts";
import type { Provider } from "@/core/di/provider.ts";
import { component as coreComponent } from "@/core/metadata/component.ts";
import type { ComponentDef, DirectiveDef, PipeDef } from "@/core/metadata/def.ts";
import { directive as coreDirective } from "@/core/metadata/directive.ts";
import { pipe as corePipe } from "@/core/metadata/pipe.ts";
import type { ApplicationRef } from "@/core/platform/application-ref.ts";
import type { BootstrapOptions } from "@/core/platform/bootstrap.ts";

// Superficie de autoría re-exportada con identidad preservada (mismos tokens/decoradores).
export * from "@/core/index.ts";
export { NgContainer, NgContent, NgTemplateOutlet } from "@/runtime/common/index.ts";

// --- Forma funcional que auto-registra --------------------------------------

export function component(clase: Function): { define(def: ComponentDef): Function } {
  return {
    define(def: ComponentDef): Function {
      coreComponent(clase).define(def);
      compatRegistry.declare(clase);
      return clase;
    },
  };
}

export function directive(clase: Function): { define(def: DirectiveDef): Function } {
  return {
    define(def: DirectiveDef): Function {
      coreDirective(clase).define(def);
      compatRegistry.declare(clase);
      return clase;
    },
  };
}

export function pipe(clase: Function): { define(def: PipeDef): Function } {
  return {
    define(def: PipeDef): Function {
      corePipe(clase).define(def);
      compatRegistry.declare(clase);
      return clase;
    },
  };
}

export function injectable<T extends object>(target: T, options?: InjectableOptions): T {
  coreInjectable(target, options);
  compatRegistry.provide(target as unknown as Provider);
  return target;
}

// --- Decoradores legacy que rutean por la forma funcional -------------------

export function Component(def: ComponentDef): ClassDecorator {
  return (clase) => {
    component(clase as unknown as Function).define(def);
  };
}

export function Directive(def: DirectiveDef): ClassDecorator {
  return (clase) => {
    directive(clase as unknown as Function).define(def);
  };
}

export function Pipe(def: PipeDef): ClassDecorator {
  return (clase) => {
    pipe(clase as unknown as Function).define(def);
  };
}

export function Injectable(config?: InjectableOptions): ClassDecorator {
  return (clase) => {
    CoreInjectableDecorator(config)(clase);
    compatRegistry.provide(clase as unknown as Provider);
  };
}

// --- Bootstrap -------------------------------------------------------------

/** Monta todo lo definido hasta ahora en `rootSelector` y arranca la app. */
export function bootstrap(root: string | Element, options?: BootstrapOptions): Promise<ApplicationRef> {
  return compatRegistry.bootstrap(root, options);
}
