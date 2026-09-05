/**
 * Servicio de app (registrado en `ng.js.core`) que junta los callbacks de
 * `afterRender`/`afterNextRender` (`after-render.ts`). `ApplicationRefImpl`
 * lo inyecta y llama `.notify()` justo después de cada `$digest()` real en
 * `tick()` — así el contrato público de `ApplicationRef` (que en Angular real
 * tampoco expone esto) queda intacto. Puramente interno: sin abstract/Impl,
 * nadie lo inyecta por token abstracto desde afuera.
 */
export class AfterRenderEventManager {
  static readonly $name = "AfterRenderEventManager";

  private readonly callbacks = new Set<() => void>();

  register(callback: () => void): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  notify(): void {
    for (const callback of this.callbacks) callback();
  }
}
