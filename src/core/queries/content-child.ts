import type { QueryOptions, QueryToken } from "@/core/queries/query-types.ts";

/** Como `ViewChildQuery`, pero para contenido proyectado (`@ContentChild`) — misma resolución en `$postLink`, ver `ng-ref-bridge.ts`. */
export class ContentChildQuery<T> {
  private _value: T | undefined;

  constructor(
    public readonly locator: QueryToken<T>,
    public readonly options: QueryOptions<T> = {},
  ) {}

  get value(): T | undefined {
    return this._value;
  }

  resolve(value: unknown): void {
    this._value = value as T;
  }

  reset(): void {
    this._value = undefined;
  }
}

/** Piel JS — `class Foo { proyectado = contentChild(Hijo) }`. */
export function contentChild<T>(locator: QueryToken<unknown>, options?: QueryOptions<T>): T | undefined {
  return new ContentChildQuery(locator, options) as unknown as T | undefined;
}

const decoratedQueries = new WeakMap<object, Map<PropertyKey, { locator: QueryToken<unknown>; options?: QueryOptions }>>();

/** Piel TS — decorador de propiedad, mismo patrón por-prototipo que `@ViewChild`. */
export function ContentChild(locator: QueryToken<unknown>, options?: QueryOptions): PropertyDecorator {
  return (target, propertyKey) => {
    let byProperty = decoratedQueries.get(target);
    if (!byProperty) {
      byProperty = new Map();
      decoratedQueries.set(target, byProperty);
    }
    byProperty.set(propertyKey, { locator, options });
  };
}

export interface DecoratedContentChildQuery {
  propertyKey: PropertyKey;
  query: ContentChildQuery<unknown>;
}

export function createDecoratedContentChildQueries(controller: object): DecoratedContentChildQuery[] {
  const chain: object[] = [];
  for (let proto: object | null = Object.getPrototypeOf(controller); proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
    chain.unshift(proto);
  }

  const results: DecoratedContentChildQuery[] = [];
  for (const proto of chain) {
    const byProperty = decoratedQueries.get(proto);
    if (!byProperty) continue;
    for (const [propertyKey, definition] of byProperty) {
      results.push({ propertyKey, query: new ContentChildQuery(definition.locator, definition.options) });
    }
  }
  return results;
}
