/**
 * Fases de un render, en el ORDEN en que Angular real las corre — todos los
 * `earlyRead` de la app antes que cualquier `write`, todos los `write` antes
 * que cualquier `mixedReadWrite`, etc. Es lo que evita layout thrashing: leer
 * el DOM (`earlyRead`/`read`) intercalado con escribirlo (`write`) fuerza
 * reflow de más. Un callback plano (`afterRender(fn)`) se trata como
 * `mixedReadWrite` — la fase "sin garantías", que puede leer y escribir.
 */
export type AfterRenderPhase = "earlyRead" | "write" | "mixedReadWrite" | "read";

const PHASE_ORDER: readonly AfterRenderPhase[] = ["earlyRead", "write", "mixedReadWrite", "read"];

export type AfterRenderSpec = Partial<Record<AfterRenderPhase, () => void>>;

/**
 * Servicio de app (registrado en `ng.js.core`) que junta los callbacks de
 * `afterRender`/`afterEveryRender`/`afterNextRender` (`after-render.ts`),
 * agrupados por fase. `ApplicationRefImpl` lo inyecta y llama `.notify()`
 * justo después de cada `$digest()` real en `tick()` — así el contrato
 * público de `ApplicationRef` (que en Angular real tampoco expone esto) queda
 * intacto. Puramente interno: sin abstract/Impl, nadie lo inyecta por token
 * abstracto desde afuera.
 */
export class AfterRenderEventManager {
  static readonly $name = "AfterRenderEventManager";

  private readonly phases: Record<AfterRenderPhase, Set<() => void>> = {
    earlyRead: new Set(),
    write: new Set(),
    mixedReadWrite: new Set(),
    read: new Set(),
  };

  register(spec: AfterRenderSpec): () => void {
    const entries = Object.entries(spec) as [AfterRenderPhase, () => void][];
    for (const [phase, callback] of entries) this.phases[phase].add(callback);

    return () => {
      for (const [phase, callback] of entries) this.phases[phase].delete(callback);
    };
  }

  notify(): void {
    for (const phase of PHASE_ORDER) {
      for (const callback of this.phases[phase]) callback();
    }
  }
}
