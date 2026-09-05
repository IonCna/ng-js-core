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
 */
export function applyConstructorInject(ctor: Function): void {
  const ownInject = Object.hasOwn(ctor, "$inject");
  if (!ownInject) {
    const overrides = injectOverrides.get(ctor);
    const paramTypes = getDesignParamTypes(ctor);

    if (!paramTypes.length && !overrides?.size) {
      (ctor as unknown as { $inject: readonly InjectionEntry[] }).$inject = [];
    } else {
      (ctor as unknown as { $inject: readonly InjectionEntry[] }).$inject = paramTypes.map(
        (paramType, index) => (overrides?.get(index) ?? paramType) as InjectionEntry,
      );
    }
  }

  ensureInject(ctor);
}
