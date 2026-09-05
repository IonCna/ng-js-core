import { AfterRenderEventManager } from "@/core/lifecycle/after-render-event-manager.ts";
import { inject } from "@/core/di/inject.ts";

export interface AfterRenderRef {
  /** Desengancha el callback — ninguna de las dos funciones se limpia sola. */
  destroy(): void;
}

/**
 * Corre `callback` después de cada render (cada `$digest()` real disparado
 * por `ApplicationRef.tick()`), de forma indefinida hasta `destroy()`. Global
 * a la app, no por-componente — igual que en Angular real, no hay CD por
 * componente acá (ver CONCEPTOS "Detección de cambios").
 */
export function afterRender(callback: () => void): AfterRenderRef {
  const manager = inject(AfterRenderEventManager);
  const destroy = manager.register(callback);
  return { destroy };
}

/** Como `afterRender`, pero se desengancha solo después de la primera vez que corre. */
export function afterNextRender(callback: () => void): AfterRenderRef {
  const manager = inject(AfterRenderEventManager);
  const destroy = manager.register(() => {
    destroy();
    callback();
  });
  return { destroy };
}
