import type { QueryOptions, QueryToken } from "@/core/queries/query-types.ts";

/**
 * Caja de una query — la resuelve de verdad `ng-ref-bridge.ts` en `$postLink`
 * (recién ahí todos los hijos ya se publicaron). `viewChild()`/`@ViewChild`
 * nunca devuelven el valor directo, devuelven ESTO disfrazado (ver abajo).
 */
export class ViewChildQuery<T> {
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

/**
 * Piel JS — `class Foo { hijo = viewChild(Hijo) }`. Devuelve un
 * `ViewChildQuery` disfrazado de `T | undefined` (mentira de tipos a
 * propósito, mismo truco que el `viewChild()` signal-based de Angular real):
 * el campo se detecta como propio de la instancia (`ng-ref-bridge.ts` mira
 * `instanceof ViewChildQuery`) y se reemplaza por un getter que lee `.value`.
 */
export function viewChild<T>(locator: QueryToken<unknown>, options?: QueryOptions<T>): T | undefined {
  return new ViewChildQuery(locator, options) as unknown as T | undefined;
}

const decoratedQueries = new WeakMap<object, Map<PropertyKey, { locator: QueryToken<unknown>; options?: QueryOptions }>>();

/**
 * Piel TS — decorador de propiedad. Corre una sola vez, al definir la clase:
 * solo anota `{propertyKey, locator}` por-prototipo (igual que `@Input` en
 * `store.ts`). La query de verdad se crea recién por INSTANCIA, al construir
 * (`createDecoratedViewChildQueries`) — nunca se comparte entre instancias.
 */
export function ViewChild(locator: QueryToken<unknown>, options?: QueryOptions): PropertyDecorator {
  return (target, propertyKey) => {
    let byProperty = decoratedQueries.get(target);
    if (!byProperty) {
      byProperty = new Map();
      decoratedQueries.set(target, byProperty);
    }
    byProperty.set(propertyKey, { locator, options });
  };
}

export interface DecoratedViewChildQuery {
  propertyKey: PropertyKey;
  query: ViewChildQuery<unknown>;
}

/** Junta lo anotado por `@ViewChild` en toda la cadena de prototipos de `controller` (padre → hijo), una query fresca por cada uno. */
export function createDecoratedViewChildQueries(controller: object): DecoratedViewChildQuery[] {
  const chain: object[] = [];
  for (let proto: object | null = Object.getPrototypeOf(controller); proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
    chain.unshift(proto);
  }

  const results: DecoratedViewChildQuery[] = [];
  for (const proto of chain) {
    const byProperty = decoratedQueries.get(proto);
    if (!byProperty) continue;
    for (const [propertyKey, definition] of byProperty) {
      results.push({ propertyKey, query: new ViewChildQuery(definition.locator, definition.options) });
    }
  }
  return results;
}
