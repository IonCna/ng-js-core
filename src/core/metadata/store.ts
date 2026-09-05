import type { HostBindingDef, HostListenerDef, InputDef, OutputDef } from "@/core/metadata/def.ts";

/**
 * Bucket de `@Input`/`@Output`/`@Model`/`@HostBinding`/`@HostListener` —
 * corren antes que el decorador de clase (`@Component`/`@Directive`), así
 * que necesitan un lugar donde acumular hasta que la clase termine de
 * decorarse. Se guarda por `prototype`, no por constructor, para poder
 * fundir lo heredado al subclasear (ver `collectMetadata`).
 */
interface MetadataBucket {
  inputs: InputDef[];
  outputs: OutputDef[];
  hostBindings: HostBindingDef[];
  hostListeners: HostListenerDef[];
}

const buckets = new WeakMap<object, MetadataBucket>();

function ownBucket(prototype: object): MetadataBucket {
  let bucket = buckets.get(prototype);
  if (!bucket) {
    bucket = { inputs: [], outputs: [], hostBindings: [], hostListeners: [] };
    buckets.set(prototype, bucket);
  }
  return bucket;
}

export function addInputDef(prototype: object, def: InputDef): void {
  ownBucket(prototype).inputs.push(def);
}

export function addOutputDef(prototype: object, def: OutputDef): void {
  ownBucket(prototype).outputs.push(def);
}

export function addHostBindingDef(prototype: object, def: HostBindingDef): void {
  ownBucket(prototype).hostBindings.push(def);
}

export function addHostListenerDef(prototype: object, def: HostListenerDef): void {
  ownBucket(prototype).hostListeners.push(def);
}

/** Junta el bucket propio de `prototype` con el heredado (padre → hijo, en ese orden). */
export function collectMetadata(prototype: object): MetadataBucket {
  const chain: object[] = [];
  for (let current: object | null = prototype; current && current !== Object.prototype; current = Object.getPrototypeOf(current)) {
    chain.unshift(current);
  }

  const inputs: InputDef[] = [];
  const outputs: OutputDef[] = [];
  const hostBindings: HostBindingDef[] = [];
  const hostListeners: HostListenerDef[] = [];
  for (const proto of chain) {
    const bucket = buckets.get(proto);
    if (bucket) {
      inputs.push(...bucket.inputs);
      outputs.push(...bucket.outputs);
      hostBindings.push(...bucket.hostBindings);
      hostListeners.push(...bucket.hostListeners);
    }
  }
  return { inputs, outputs, hostBindings, hostListeners };
}
