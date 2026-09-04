import type { InputDef, OutputDef } from "@/core/metadata/def.ts";
import { InputMarker, ModelMarker, OutputMarker } from "@/core/metadata/markers.ts";
import { collectMetadata } from "@/core/metadata/store.ts";

interface WithJsBindings {
  bindings?: Record<string, InputMarker<unknown> | OutputMarker<unknown> | ModelMarker<unknown>>;
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
