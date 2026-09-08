import type angular from "angular";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import { getDirectiveDef } from "@/core/metadata/directive.ts";
import { chainInstanceMethod, decorateControllerWith } from "@/runtime/bridges/shared.ts";

interface EmitterLike {
  subscribe(next: (value: unknown) => void): { unsubscribe(): void };
  emit?(value?: unknown): void;
}

/**
 * Cualquier `Subscribable` sirve como `@Output`: un `EventEmitter` (tiene
 * `emit`), pero también un `Observable`/`Subject` pelado — ng-bootstrap hace
 * `@Output() activeChange = this._service.active$`. Solo hace falta `subscribe`
 * para cablearlo al binding `&`; `emit` es opcional.
 */
function isEmitterLike(value: unknown): value is EmitterLike {
  return !!value && typeof value === "object" && typeof (value as EmitterLike).subscribe === "function";
}

function outputDefsOf(instance: object): { propName: string }[] {
  const ctor = instance.constructor as Function;
  return getComponentDef(ctor)?.outputs ?? getDirectiveDef(ctor)?.outputs ?? [];
}

/**
 * `@Output() x = new EventEmitter()` (estilo Angular / ng-bootstrap): el campo se
 * inicializa a un emitter en el ctor. Al bindear, AngularJS asigna `this.x` con
 * la función del binding `&` (evalúa la expresión del padre), lo que pisaría el
 * emitter.
 *
 * En Angular el emitter NUNCA se pisa y ya está suscrito cuando corre el primer
 * `ngOnChanges` (que va ANTES de `ngOnInit`), así que un `this.x.emit(v)` dentro
 * de ese primer `ngOnChanges` funciona. Para lograr la misma semántica, este
 * bridge redefine `this.x` como accessor en cuanto se construye el controller:
 *   - `get` devuelve siempre el emitter → `this.x.emit(v)` anda desde el primer
 *     momento, incluso en `$onChanges` (antes de `$onInit`),
 *   - `set` (lo llama AngularJS con la función `&`) guarda esa función aparte y
 *     suscribe el emitter a ella → `x.emit(v)` dispara `(x)="handler($event)"`.
 * La suscripción se limpia en `$onDestroy`. Si el `@Output` no es un emitter
 * (uso viejo como callback `&`), no toca nada.
 */
export function decorateControllerOutputEmitters(
  $delegate: angular.IControllerService,
): angular.IControllerService {
  return decorateControllerWith($delegate, {
    onInstance: (instance) => {
      if (!instance || typeof instance !== "object") return;

      const outputs = outputDefsOf(instance).filter((output) =>
        isEmitterLike((instance as Record<string, unknown>)[output.propName]),
      );
      if (outputs.length === 0) return;

      const activeSubs = new Map<string, { unsubscribe(): void }>();

      for (const { propName } of outputs) {
        const emitter = (instance as Record<string, unknown>)[propName] as EmitterLike;
        let boundFn: unknown;

        Object.defineProperty(instance, propName, {
          configurable: true,
          enumerable: true,
          get: () => emitter,
          set: (value: unknown) => {
            if (value === boundFn) return;
            boundFn = value;
            activeSubs.get(propName)?.unsubscribe();
            activeSubs.delete(propName);
            if (typeof value === "function") {
              activeSubs.set(
                propName,
                emitter.subscribe((emitted) => (value as (locals: object) => unknown)({ $event: emitted })),
              );
            }
          },
        });
      }

      chainInstanceMethod(instance, "$onDestroy", () => {
        for (const subscription of activeSubs.values()) subscription.unsubscribe();
        activeSubs.clear();
      });
    },
  });
}
decorateControllerOutputEmitters.$inject = ["$delegate"];
