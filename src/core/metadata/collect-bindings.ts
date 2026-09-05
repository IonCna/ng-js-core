import type { HostDef, InputDef, OutputDef } from "@/core/metadata/def.ts";
import { HostBindingMarker, HostListenerMarker, InputMarker, ModelMarker, OutputMarker } from "@/core/metadata/markers.ts";
import { collectMetadata } from "@/core/metadata/store.ts";

interface WithJsBindings {
  bindings?: Record<string, InputMarker<unknown> | OutputMarker<unknown> | ModelMarker<unknown>>;
}

interface WithJsHostListeners {
  hostListeners?: Record<string, HostListenerMarker>;
}

interface WithJsHostBindings {
  hostBindings?: Record<string, HostBindingMarker>;
}

/**
 * Junta los dos caminos de autoría de bindings en una sola lista: el bucket
 * de `@Input`/`@Output` (por prototype) y `static bindings` (`input()`/
 * `output()` de JS, vía `bindings()`). `component()`/`@Component` (y
 * `directive()`/`@Directive`) llaman esto al registrar — el consumidor nunca
 * declara `inputs`/`outputs` a mano en el `def`.
 */
export function collectBindings(Clase: Function): { inputs: InputDef[]; outputs: OutputDef[] } {
  const fromDecorators = collectMetadata((Clase as unknown as { prototype: object }).prototype);
  const jsBindings = (Clase as unknown as WithJsBindings).bindings ?? {};

  const inputs = [...fromDecorators.inputs];
  const outputs = [...fromDecorators.outputs];

  for (const [propName, marker] of Object.entries(jsBindings)) {
    if (marker instanceof InputMarker) {
      inputs.push({ propName, bindingName: propName, required: marker.required });
    } else if (marker instanceof ModelMarker) {
      inputs.push({ propName, bindingName: propName, required: marker.required, twoWay: true });
    } else if (marker instanceof OutputMarker) {
      outputs.push({ propName, bindingName: propName });
    }
  }

  return { inputs, outputs };
}

/**
 * Junta los dos caminos de autoría de host bindings/listeners: el bucket de
 * `@HostBinding`/`@HostListener` (por prototype) y `static hostListeners`
 * (`hostListener()` de JS). Mismo trato que `collectBindings`: el consumidor
 * nunca lo declara a mano en el `def` — `component()`/`directive()` lo
 * calculan solos al registrar.
 */
export function collectHost(Clase: Function): HostDef {
  const fromDecorators = collectMetadata((Clase as unknown as { prototype: object }).prototype);
  const jsHostListeners = (Clase as unknown as WithJsHostListeners).hostListeners ?? {};
  const jsHostBindings = (Clase as unknown as WithJsHostBindings).hostBindings ?? {};

  const listeners = [...fromDecorators.hostListeners];
  for (const [methodName, marker] of Object.entries(jsHostListeners)) {
    if (marker instanceof HostListenerMarker) {
      listeners.push({ methodName, eventName: marker.eventName, args: marker.args });
    }
  }

  const bindings = [...fromDecorators.hostBindings];
  for (const [propName, marker] of Object.entries(jsHostBindings)) {
    if (marker instanceof HostBindingMarker) {
      bindings.push({ propName, hostProperty: marker.hostProperty });
    }
  }

  return { bindings, listeners };
}
