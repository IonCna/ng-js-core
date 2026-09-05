import { QueryList } from "@/core/queries/query-list.ts";
import type { QueryToken } from "@/core/queries/query-types.ts";

/**
 * Como `ViewChildQuery` pero junta TODOS los hijos que matcheen, no el
 * primero. `asQueryList` decide la forma de `.value`: array plano
 * (`viewChildren()`, función suelta) o `QueryList` viva (`@ViewChildren`,
 * decorador) — mismo split que Angular real.
 */
export class ViewChildrenQuery<T> {
  private readonly queryList?: QueryList<T>;
  private values: T[] = [];

  constructor(
    public readonly locator: QueryToken<T>,
    asQueryList: boolean,
  ) {
    if (asQueryList) this.queryList = new QueryList<T>();
  }

  get value(): readonly T[] | QueryList<T> {
    return this.queryList ?? this.values;
  }

  resolve(values: readonly unknown[]): void {
    this.values = values as T[];
    if (this.queryList) {
      this.queryList.reset(this.values);
      this.queryList.notifyOnChanges();
    }
  }

  reset(): void {
    this.resolve([]);
  }

  destroy(): void {
    this.queryList?.destroy();
  }
}

/** Piel JS — `class Foo { hijos = viewChildren(Hijo) }`. Array plano, snapshot resuelto en `$postLink`. */
export function viewChildren<T>(locator: QueryToken<T>): readonly T[] {
  return new ViewChildrenQuery(locator, false) as unknown as readonly T[];
}

const decoratedQueries = new WeakMap<object, Map<PropertyKey, QueryToken<unknown>>>();

/** Piel TS — `@ViewChildren(Hijo) hijos!: QueryList<Hijo>`. Mismo patrón por-prototipo que `@ViewChild`. */
export function ViewChildren(locator: QueryToken<unknown>): PropertyDecorator {
  return (target, propertyKey) => {
    let byProperty = decoratedQueries.get(target);
    if (!byProperty) {
      byProperty = new Map();
      decoratedQueries.set(target, byProperty);
    }
    byProperty.set(propertyKey, locator);
  };
}

export interface DecoratedViewChildrenQuery {
  propertyKey: PropertyKey;
  query: ViewChildrenQuery<unknown>;
}

export function createDecoratedViewChildrenQueries(controller: object): DecoratedViewChildrenQuery[] {
  const chain: object[] = [];
  for (let proto: object | null = Object.getPrototypeOf(controller); proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
    chain.unshift(proto);
  }

  const results: DecoratedViewChildrenQuery[] = [];
  for (const proto of chain) {
    const byProperty = decoratedQueries.get(proto);
    if (!byProperty) continue;
    for (const [propertyKey, locator] of byProperty) {
      results.push({ propertyKey, query: new ViewChildrenQuery(locator, true) });
    }
  }
  return results;
}
