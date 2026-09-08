import type angular from "angular";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import { getDirectiveDef } from "@/core/metadata/directive.ts";
import { decorateControllerWith, prependInstanceMethod } from "@/runtime/bridges/shared.ts";

const PATCHED = Symbol("ngjsInputDeferPatched");
const READY = Symbol("ngjsInputsReady");
const PENDING = Symbol("ngjsPendingInputs");

interface DeferState {
  [READY]?: boolean;
  [PENDING]?: Map<string, unknown>;
}

/**
 * Angular escribe los `@Input` de una directiva durante la detección de cambios
 * del host — DESPUÉS de crear el contenido y resolver las queries
 * `{ static: true }`. AngularJS los asigna sincrónicamente en el link, ANTES de
 * linkear los hijos: un `@Input set` que lee un `@ContentChild`/`@ViewChild`
 * estático lo ve `undefined` y explota (típico `TypeError`).
 *
 * Este bridge parcha los SETTERS de `@Input` de cada `@Directive`: si el setter
 * tira durante ese link temprano, el valor se guarda y se re-aplica en
 * `$postLink`, ya con las queries resueltas. Un setter que NO tira corre igual
 * que siempre — sin cambio de timing, sin riesgo.
 *
 * Orden: se registra INTERNO a `ng-ref-bridge` (queries), así el `resolve()` de
 * las queries —que ese bridge mete con `prependInstanceMethod` en `$postLink`—
 * envuelve por fuera a este replay y corre antes.
 */
export function decorateControllerInputDefer($delegate: angular.IControllerService): angular.IControllerService {
  return decorateControllerWith($delegate, {
    onInstance: (instance) => {
      if (!instance) return;
      const Clase = (instance as { constructor: Function }).constructor;
      // Solo `@Directive` puro: un `@Component` tiene otro ciclo de queries y no
      // hubo casos que lo necesiten.
      if (getComponentDef(Clase)) return;
      const def = getDirectiveDef(Clase);
      if (!def || def.inputs.length === 0) return;

      patchInputSetters(
        Clase,
        def.inputs.map((input) => input.propName),
      );

      prependInstanceMethod(instance as object, "$postLink", () => {
        const state = instance as DeferState & Record<string, unknown>;
        state[READY] = true;
        const pending = state[PENDING];
        if (!pending || pending.size === 0) return;
        const entries = [...pending];
        pending.clear();
        // Re-aplica en orden de llegada. Si el setter todavía tira acá, es un
        // error real (no de timing) — que se propague.
        for (const [prop, value] of entries) {
          (state as Record<string, unknown>)[prop] = value;
        }
      });
    },
  });
}
decorateControllerInputDefer.$inject = ["$delegate"];

function patchInputSetters(Clase: Function, propNames: string[]): void {
  const proto = (Clase as { prototype: object }).prototype as Record<PropertyKey, unknown> & { [PATCHED]?: boolean };
  if (proto[PATCHED]) return;
  proto[PATCHED] = true;

  for (const prop of propNames) {
    const found = findAccessor(proto, prop);
    // Sin setter propio: es un campo plano (`@Input() x = 0`). Asignarlo no
    // tiene efectos que dependan del timing — se deja como está.
    if (!found || typeof found.desc.set !== "function") continue;

    const originalSet = found.desc.set;
    const originalGet = found.desc.get;

    Object.defineProperty(proto, prop, {
      configurable: true,
      enumerable: found.desc.enumerable ?? false,
      get: originalGet
        ? function (this: unknown) {
            return originalGet.call(this);
          }
        : undefined,
      set(this: DeferState, value: unknown) {
        if (this[READY]) {
          originalSet.call(this, value);
          return;
        }
        try {
          originalSet.call(this, value);
        } catch {
          (this[PENDING] ??= new Map()).set(prop, value);
        }
      },
    });
  }
}

function findAccessor(
  proto: object,
  prop: PropertyKey,
): { target: object; desc: PropertyDescriptor } | undefined {
  for (let target: object | null = proto; target && target !== Object.prototype; target = Object.getPrototypeOf(target)) {
    const desc = Object.getOwnPropertyDescriptor(target, prop);
    if (desc) return { target, desc };
  }
  return undefined;
}
