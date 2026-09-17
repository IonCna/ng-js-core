import { ensureInject, type InjectionEntry } from "@/core/di/reflect.ts";

/**
 * Overrides por posición de parámetro, escritos por `@Inject(token)`. Viven acá
 * (no en `injectable.ts`) para que `@Component`/`@Directive` puedan resolver la
 * DI de constructor con el mismo mecanismo que `@Injectable`, sin ciclo de imports.
 */
const injectOverrides = new WeakMap<Function, Map<number, InjectionEntry>>();

export function setInjectOverride(ctor: Function, parameterIndex: number, token: InjectionEntry): void {
  let overrides = injectOverrides.get(ctor);
  if (!overrides) {
    overrides = new Map();
    injectOverrides.set(ctor, overrides);
  }
  overrides.set(parameterIndex, token);
}

function getDesignParamTypes(target: Function): unknown[] {
  const withMetadata = Reflect as unknown as {
    getMetadata?: (key: string, target: Function) => unknown;
  };
  if (typeof withMetadata.getMetadata !== "function") return [];
  return (withMetadata.getMetadata("design:paramtypes", target) as unknown[] | undefined) ?? [];
}

/**
 * Deja `ctor.$inject` listo para AngularJS: si la clase ya declara un `$inject`
 * propio (array o getter, estilo AngularJS puro), se respeta; si no, se sintetiza
 * desde `design:paramtypes` (emitido por `emitDecoratorMetadata` en TS) pisando
 * cada posición con lo que haya puesto `@Inject`. Después traduce los tokens no-string
 * a nombres (`ensureInject`). Sin metadata ni overrides → `$inject = []`.
 *
 * La longitud del array sale de `Math.max(paramTypes.length, 1 + índice más
 * alto con override de @Inject)`, no solo de `paramTypes.length`: sin
 * `emitDecoratorMetadata`/`reflect-metadata` activo (como en `ngb-js`),
 * `paramTypes` queda `[]` aunque el constructor declare parámetros — ahí el
 * override más alto es la única forma de saber cuántas posiciones hay que
 * llenar. **No** se usa `ctor.length` a secas: hay clases con parámetros de
 * constructor sin `@Inject` a propósito (p.ej. `new Foo()` fuera de DI, con
 * `inject()` de fallback adentro) que deben seguir sintetizando `$inject = []`
 * si no tienen NINGÚN override ni metadata.
 */
export function applyConstructorInject(ctor: Function): void {
  const ownInject = Object.hasOwn(ctor, "$inject");
  if (!ownInject) {
    const overrides = injectOverrides.get(ctor);
    const paramTypes = getDesignParamTypes(ctor);
    const maxOverrideIndex = overrides?.size ? Math.max(...overrides.keys()) : -1;
    const length = Math.max(paramTypes.length, maxOverrideIndex + 1);

    if (!length) {
      (ctor as unknown as { $inject: readonly InjectionEntry[] }).$inject = [];
    } else {
      (ctor as unknown as { $inject: readonly InjectionEntry[] }).$inject = Array.from(
        { length },
        (_, index) => (overrides?.get(index) ?? paramTypes[index]) as InjectionEntry,
      );
    }
  }

  ensureInject(ctor);
}
