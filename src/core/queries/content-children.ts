import { QueryList } from "@/core/queries/query-list.ts";
import type { QueryOptions, QueryToken } from "@/core/queries/query-types.ts";

/** Como `ViewChildrenQuery`, pero para contenido proyectado (`@ContentChildren`). */
export class ContentChildrenQuery<T> {
  private readonly queryList?: QueryList<T>;
  private values: T[] = [];

  constructor(
    public readonly locator: QueryToken<T>,
    asQueryList: boolean,
    public readonly options: QueryOptions<T> = {},
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

/** Piel JS — `class Foo { proyectados = contentChildren(Hijo) }`. Array plano. */
export function contentChildren<T>(locator: QueryToken<unknown>, options?: QueryOptions<T>): readonly T[] {
  return new ContentChildrenQuery(locator, false, options) as unknown as readonly T[];
}

const decoratedQueries = new WeakMap<object, Map<PropertyKey, { locator: QueryToken<unknown>; options?: QueryOptions }>>();

/** Piel TS — `@ContentChildren(Hijo) proyectados!: QueryList<Hijo>`. */
export function ContentChildren(locator: QueryToken<unknown>, options?: QueryOptions): PropertyDecorator {
  return (target, propertyKey) => {
    let byProperty = decoratedQueries.get(target);
    if (!byProperty) {
      byProperty = new Map();
      decoratedQueries.set(target, byProperty);
    }
    byProperty.set(propertyKey, { locator, options });
  };
}

export interface DecoratedContentChildrenQuery {
  propertyKey: PropertyKey;
  query: ContentChildrenQuery<unknown>;
}

export function createDecoratedContentChildrenQueries(controller: object): DecoratedContentChildrenQuery[] {
  const chain: object[] = [];
  for (let proto: object | null = Object.getPrototypeOf(controller); proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
    chain.unshift(proto);
  }

  const results: DecoratedContentChildrenQuery[] = [];
  for (const proto of chain) {
    const byProperty = decoratedQueries.get(proto);
    if (!byProperty) continue;
    for (const [propertyKey, definition] of byProperty) {
      results.push({ propertyKey, query: new ContentChildrenQuery(definition.locator, true, definition.options) });
    }
  }
  return results;
}
