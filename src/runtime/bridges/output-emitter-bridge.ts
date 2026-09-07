import type angular from "angular";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import { getDirectiveDef } from "@/core/metadata/directive.ts";
import { chainInstanceMethod, decorateControllerWith } from "@/runtime/bridges/shared.ts";

interface EmitterLike {
  subscribe(next: (value: unknown) => void): { unsubscribe(): void };
  emit?(value?: unknown): void;
}

function isEmitterLike(value: unknown): value is EmitterLike {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as EmitterLike).subscribe === "function" &&
    typeof (value as { emit?: unknown }).emit === "function"
  );
}

function outputDefsOf(instance: object): { propName: string }[] {
  const ctor = instance.constructor as Function;
  return getComponentDef(ctor)?.outputs ?? getDirectiveDef(ctor)?.outputs ?? [];
}

/**
 * `@Output() x = new EventEmitter()` (estilo Angular / ng-bootstrap): el campo se
 * inicializa a un emitter en el ctor. Al bindear, AngularJS pisa `this.x` con la
 * función del binding `&` (evalúa la expresión del padre). Este bridge, en
 * `$onInit` (ya aplicados los bindings):
 *   1. rescata esa función `&`,
 *   2. restaura el emitter en `this.x` (para que `this.x.emit(v)` ande),
 *   3. suscribe el emitter a la función → `x.emit(v)` dispara `(x)="handler($event)"`.
 * Se limpia en `$onDestroy`. Si el `@Output` no es un emitter (uso viejo como
 * callback `&`), no toca nada.
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

      const captured = new Map<string, EmitterLike>();
      for (const output of outputs) {
        captured.set(output.propName, (instance as Record<string, EmitterLike>)[output.propName]);
      }

      chainInstanceMethod(instance, "$onInit", () => {
        const target = instance as Record<string, unknown>;
        for (const [propName, emitter] of captured) {
          const boundFn = target[propName];
          target[propName] = emitter;
          if (typeof boundFn === "function") {
            const subscription = emitter.subscribe((value) => (boundFn as (locals: object) => unknown)({ $event: value }));
            chainInstanceMethod(instance, "$onDestroy", () => subscription.unsubscribe());
          }
        }
      });
    },
  });
}
decorateControllerOutputEmitters.$inject = ["$delegate"];
