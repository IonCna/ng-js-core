import { QueryList } from "@/core/queries/query-list.ts";
import { type QueryOptions, type QueryToken, resolveQueryLocator, resolveQueryOptions } from "@/core/queries/query-types.ts";

/**
 * Como `ViewChildQuery` pero junta TODOS los hijos que matcheen, no el
 * primero. `asQueryList` decide la forma de `.value`: array plano
 * (`viewChildren()`, función suelta) o `QueryList` viva (`@ViewChildren`,
 * decorador) — mismo split que Angular real.
 */
export class ViewChildrenQuery<T> {
  private readonly queryList?: QueryList<T>;
  private values: T[] = [];
  /** El primer `resolve()` corre en `ngAfterViewInit`. Antes, el campo
   * `@ViewChildren` vale `undefined` — como en Angular. La forma de array plano
   * (`viewChildren()` función) sigue devolviendo `[]`. */
  private resolved = false;

  constructor(
    public readonly locator: QueryToken<T>,
    asQueryList: boolean,
    public readonly options: QueryOptions<T> = {},
  ) {
    if (asQueryList) this.queryList = new QueryList<T>();
  }

  get value(): readonly T[] | QueryList<T> | undefined {
    if (this.queryList) return this.resolved ? this.queryList : undefined;
    return this.values;
  }

  resolve(values: readonly unknown[]): void {
    this.resolved = true;
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
export function viewChildren<T>(locator: QueryToken<unknown>, options?: QueryOptions<T>): readonly T[] {
  return new ViewChildrenQuery(locator, false, options) as unknown as readonly T[];
}

const decoratedQueries = new WeakMap<object, Map<PropertyKey, { locator: QueryToken<unknown>; options?: QueryOptions }>>();

/** Piel TS — `@ViewChildren(Hijo) hijos!: QueryList<Hijo>`. Mismo patrón por-prototipo que `@ViewChild`. */
export function ViewChildren(locator: QueryToken<unknown>, options?: QueryOptions): PropertyDecorator {
  return (target, propertyKey) => {
    let byProperty = decoratedQueries.get(target);
    if (!byProperty) {
      byProperty = new Map();
      decoratedQueries.set(target, byProperty);
    }
    byProperty.set(propertyKey, { locator, options });
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
    for (const [propertyKey, definition] of byProperty) {
      results.push({ propertyKey, query: new ViewChildrenQuery(resolveQueryLocator(definition.locator), true, resolveQueryOptions(definition.options)) });
    }
  }
  return results;
}
