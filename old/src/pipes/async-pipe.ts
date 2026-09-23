import type angular from "angular";
import type { PipeTransform } from "@/pipes/pipe-transform.ts";

interface Unsubscribable {
  unsubscribe(): void;
}

function isSubscribable(value: object): value is { subscribe(observer: (value: unknown) => void): Unsubscribable | (() => void) } {
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
export abstract class AsyncPipe implements PipeTransform<unknown, unknown> {
  static readonly $name = "AsyncPipe";

  abstract transform<T>(input: PromiseLike<T> | { subscribe(observer: (value: T) => void): Unsubscribable | (() => void) } | null | undefined): T | null;
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
