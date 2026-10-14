import type angular from "angular";
import { Injectable } from "@/core/di/injectable.ts";
import { Pipe } from "@/core/metadata/pipe.ts";
import type { PipeTransform } from "@/pipes/pipe-transform.ts";

interface Unsubscribable {
  unsubscribe(): void;
}

function isSubscribable(
  value: object,
): value is { subscribe(observer: (value: unknown) => void): Unsubscribable | (() => void) } {
  return typeof (value as { subscribe?: unknown }).subscribe === "function";
}

function isPromiseLike(value: object): value is PromiseLike<unknown> {
  return typeof (value as { then?: unknown }).then === "function";
}

function unsubscribe(handle: Unsubscribable | (() => void) | void): void {
  if (typeof handle === "function") handle();
  else handle?.unsubscribe();
}

interface CacheEntry {
  value: unknown;
  teardown: () => void;
}

/**
 * A diferencia de un `.filter()` de AngularJS (singleton de toda la app, sin
 * forma de saber a qué `$scope` pertenece cada uso), `AsyncPipe` se inyecta
 * POR-INSTANCIA (mismo mecanismo que `ElementRef`/`ViewContainerRef`, ver
 * `async-pipe-bridge.ts`) — el `$scope` queda resuelto en el momento de
 * construirse, no hay que pasarlo a mano en cada `.transform()`. Uso:
 * `constructor(private async: AsyncPipe) {}` + `{{ $ctrl.async.transform(value$) }}`.
 */
@Injectable()
export abstract class AsyncPipe implements PipeTransform<unknown, unknown> {
  abstract transform<T>(
    input:
      | PromiseLike<T>
      | { subscribe(observer: (value: T) => void): Unsubscribable | (() => void) }
      | null
      | undefined,
  ): T | null;
}

export class AsyncPipeImpl extends AsyncPipe {
  private readonly cache = new Map<object, CacheEntry>();
  private destroyed = false;

  constructor(private readonly $scope: angular.IScope) {
    super();
    $scope.$on("$destroy", () => this.destroy());
  }

  transform<T>(input: unknown): T | null {
    if (input == null || this.destroyed) return null;
    if (typeof input !== "object" && typeof input !== "function") return null;

    let entry = this.cache.get(input);
    if (!entry) {
      entry = this.subscribeTo(input);
      this.cache.set(input, entry);
    }

    return entry.value as T | null;
  }

  private subscribeTo(input: object): CacheEntry {
    const entry: CacheEntry = { value: null, teardown: () => {} };
    const onValue = (value: unknown) => {
      entry.value = value;
      if (!this.$scope.$$phase) this.$scope.$applyAsync();
    };

    if (isSubscribable(input)) {
      const handle = input.subscribe(onValue);
      entry.teardown = () => unsubscribe(handle);
    } else if (isPromiseLike(input)) {
      let cancelled = false;
      input.then((value) => {
        if (!cancelled) onValue(value);
      });
      entry.teardown = () => {
        cancelled = true;
      };
    }

    return entry;
  }

  private destroy(): void {
    this.destroyed = true;
    for (const entry of this.cache.values()) entry.teardown();
    this.cache.clear();
  }
}

function isScope(value: unknown): value is angular.IScope {
  return typeof value === "object" && value !== null && typeof (value as { $on?: unknown }).$on === "function";
}

/**
 * `| async` en el template, como en Angular. Un filtro de AngularJS es uno solo para toda la app y no sabe en qué
 * `$scope` se evalúa, así que `ng-js-template-compiler` escribe `x$ | async` como `x$ | async:this` (`this` en una
 * expresión es el scope). Cada scope tiene su `AsyncPipeImpl`: se suscribe la primera vez, pinta cada emisión y se
 * desuscribe cuando el scope se destruye (el componente, o el bloque de un `ng-if` / `ng-repeat`), como la vista de
 * Angular. `pure: false` porque el observable es la misma referencia mientras su valor cambia.
 */
@Pipe({ name: "async", pure: false })
export class AsyncFilterPipe implements PipeTransform<unknown, unknown> {
  private readonly pipes = new WeakMap<angular.IScope, AsyncPipeImpl>();

  transform(input: unknown, scope?: unknown): unknown {
    if (!isScope(scope)) {
      throw new Error(
        "async: falta el scope; el template tiene que pasar por ng-js-template-compiler, que agrega `:this`.",
      );
    }
    let pipe = this.pipes.get(scope);
    if (!pipe) {
      pipe = new AsyncPipeImpl(scope);
      this.pipes.set(scope, pipe);
    }
    return pipe.transform(input);
  }
}
