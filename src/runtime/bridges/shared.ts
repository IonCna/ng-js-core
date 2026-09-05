import type angular from "angular";

interface ControllerInitializer {
  (this: unknown): unknown;
  instance?: unknown;
  identifier?: string;
}

export interface ControllerHooks {
  /** Corre antes de invocar al `$controller` real — para agregar/pisar claves de `locals` (ej. `ElementRef`, el nodo del inyector jerárquico). */
  augmentLocals?: (locals: Record<string, unknown> | undefined) => Record<string, unknown> | undefined;
  /** Corre justo cuando de verdad se construye una instancia (ver nota de `later` abajo). */
  onInstance?: (instance: unknown, locals: Record<string, unknown> | undefined) => void;
}

/**
 * Envuelve `$controller` con dos ganchos: `augmentLocals` (antes de construir,
 * para agregar valores a `locals` que AngularJS use en vez de pedirle al
 * `$injector`) y `onInstance` (justo cuando de verdad se construye una
 * instancia — sea inmediato, o diferido con `later: true`, el caso de
 * `.component()`/`bindToController`, donde `$controller` devuelve una función
 * inicializadora que AngularJS llama después, una vez armados los bindings —
 * confirmado con un probe real: `later` siempre vino en `true` para
 * `.component()`).
 *
 * Cada feature de etapa 5 (lifecycle, `ElementRef`, inyector jerárquico,
 * hosts) arma su propio decorador de `$controller` llamando a esto con sus
 * propios hooks, en vez de reimplementar el manejo de `later`/`locals` cada vez.
 */
export function decorateControllerWith(
  $delegate: angular.IControllerService,
  hooks: ControllerHooks,
): angular.IControllerService {
  const invoke = $delegate as unknown as (
    expression: unknown,
    locals?: Record<string, unknown>,
    later?: boolean,
    identifier?: string,
  ) => unknown;

  const wrapped = (expression: unknown, locals?: Record<string, unknown>, later?: boolean, identifier?: string) => {
    const augmentedLocals = hooks.augmentLocals ? hooks.augmentLocals(locals) : locals;
    const result = invoke(expression, augmentedLocals, later, identifier);

    if (!later) {
      hooks.onInstance?.(result, augmentedLocals);
      return result;
    }

    const initializer = result as ControllerInitializer;
    const wrappedInitializer: ControllerInitializer = function (this: unknown) {
      const instance = initializer.call(this);
      hooks.onInstance?.(instance, augmentedLocals);
      return instance;
    };

    // AngularJS lee/escribe `.instance`/`.identifier` sobre lo que devuelve
    // $controller en modo `later` (ver ngControllerDirective) — hay que
    // dejarlos pasar tal cual al inicializador real, no perderlos.
    Object.defineProperty(wrappedInitializer, "instance", {
      get: () => initializer.instance,
      set: (value: unknown) => {
        initializer.instance = value;
      },
      enumerable: true,
    });
    Object.defineProperty(wrappedInitializer, "identifier", {
      get: () => initializer.identifier,
      enumerable: true,
    });

    return wrappedInitializer;
  };

  return wrapped as unknown as angular.IControllerService;
}

/**
 * Engancha `addition` a un método de ciclo de vida de AngularJS (`$postLink`,
 * `$onDestroy`, ...) SIN pisar lo que ya hubiera ahí — ni del autor, ni de
 * otro bridge nuestro que se haya enganchado antes. Lo que ya estaba corre
 * primero, `addition` después. Necesario desde que hay más de un bridge de
 * etapa 5+ queriendo el mismo hook (`lifecycle-bridge.ts` y `ng-ref-bridge.ts`
 * los dos quieren `$postLink`) — antes de esto, `lifecycle-bridge.ts` hacía
 * "si no existe, lo pongo", y el segundo bridge en pisarlo se quedaba afuera.
 */
export function chainInstanceMethod(instance: object, methodName: string, addition: () => void): void {
  const target = instance as Record<string, ((...args: unknown[]) => unknown) | undefined>;
  const previous = target[methodName];

  target[methodName] = function (this: unknown, ...args: unknown[]) {
    const result = previous?.apply(this, args);
    addition();
    return result;
  };
}
