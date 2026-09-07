import {
  type AfterRenderSpec,
  AfterRenderEventManager,
} from "@/core/lifecycle/after-render-event-manager.ts";
import { inject } from "@/core/di/inject.ts";
import type { Injector } from "@/core/di/injector.ts";

export type { AfterRenderSpec } from "@/core/lifecycle/after-render-event-manager.ts";

export interface AfterRenderRef {
  /** Desengancha el callback — ninguna de las dos funciones se limpia sola. */
  destroy(): void;
}

export interface AfterRenderOptions {
  /**
   * Injector explícito para resolver `AfterRenderEventManager` — hace falta
   * cuando se llama `afterRender`/`afterNextRender` fuera de un contexto de
   * inyección (ej. dentro de un callback de promesa). Sin esto, `inject()`
   * cae al último `Injector` bootstrapeado (`InjectorImpl.current`), que para
   * una sola app en curso da el mismo resultado — pero con más de una app (o
   * fuera de cualquier bootstrap) hace falta ser explícito.
   */
  injector?: Injector;
}

function resolveManager(options?: AfterRenderOptions): AfterRenderEventManager {
  return options?.injector ? options.injector.get(AfterRenderEventManager) : inject(AfterRenderEventManager);
}

/** Un callback plano equivale a `{ mixedReadWrite: callback }` — la fase "sin garantías", como en Angular real. */
function normalizeSpec(callbackOrSpec: (() => void) | AfterRenderSpec): AfterRenderSpec {
  return typeof callbackOrSpec === "function" ? { mixedReadWrite: callbackOrSpec } : callbackOrSpec;
}

/**
 * Corre `callback` (o las fases del `spec`) después de cada render (cada
 * `$digest()` real disparado por `ApplicationRef.tick()`), de forma indefinida
 * hasta `destroy()`. Global a la app, no por-componente — igual que en
 * Angular real, no hay CD por componente acá (ver CONCEPTOS "Detección de
 * cambios"). Las fases (`earlyRead`/`write`/`mixedReadWrite`/`read`) se
 * ejecutan en ESE orden a nivel de toda la app — todos los `earlyRead`
 * registrados (de cualquier `afterRender`/`afterNextRender`) antes que
 * cualquier `write`, etc. — para no intercalar lecturas y escrituras del DOM.
 */
export function afterEveryRender(
  callbackOrSpec: (() => void) | AfterRenderSpec,
  options?: AfterRenderOptions,
): AfterRenderRef {
  const manager = resolveManager(options);
  const destroy = manager.register(normalizeSpec(callbackOrSpec));
  return { destroy };
}

/** @deprecated Angular real lo reemplazó por `afterEveryRender` (mismo comportamiento, nombre más claro). */
export function afterRender(
  callbackOrSpec: (() => void) | AfterRenderSpec,
  options?: AfterRenderOptions,
): AfterRenderRef {
  return afterEveryRender(callbackOrSpec, options);
}

/**
 * Como `afterEveryRender`, pero se desengancha solo después de la primera vez
 * que corren TODAS las fases pedidas — si el `spec` tiene varias fases, las
 * corre todas en el mismo render antes de desenganchar (no en cuanto corre la
 * primera).
 */
export function afterNextRender(
  callbackOrSpec: (() => void) | AfterRenderSpec,
  options?: AfterRenderOptions,
): AfterRenderRef {
  const manager = resolveManager(options);
  const spec = normalizeSpec(callbackOrSpec);
  const phases = Object.keys(spec) as (keyof AfterRenderSpec)[];

  let remaining = phases.length;
  let destroy!: () => void;

  const wrapped: AfterRenderSpec = {};
  for (const phase of phases) {
    const fn = spec[phase] as () => void;
    wrapped[phase] = () => {
      fn();
      if (--remaining === 0) destroy();
    };
  }

  destroy = manager.register(wrapped);
  return { destroy };
}
