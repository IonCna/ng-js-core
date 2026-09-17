import type { HostDef, InputDef, OutputDef } from "@/core/metadata/def.ts";
import { collectMetadata } from "@/core/metadata/store.ts";

/**
 * Lee el bucket de `@Input`/`@Output` (por prototype). `component()`/`@Component`
 * (y `directive()`/`@Directive`) llaman esto al registrar — el consumidor nunca
 * declara `inputs`/`outputs` a mano en el `def`.
 */
export function collectBindings(Clase: Function): { inputs: InputDef[]; outputs: OutputDef[] } {
  const { inputs, outputs } = collectMetadata((Clase as unknown as { prototype: object }).prototype);
  return { inputs, outputs };
}

/**
 * Lee el bucket de `@HostBinding`/`@HostListener` (por prototype). Mismo trato
 * que `collectBindings`: el consumidor nunca lo declara a mano en el `def` —
 * `component()`/`directive()` lo calculan solos al registrar.
 */
export function collectHost(Clase: Function): HostDef {
  const { hostBindings, hostListeners } = collectMetadata((Clase as unknown as { prototype: object }).prototype);
  return { bindings: hostBindings, listeners: hostListeners };
}
