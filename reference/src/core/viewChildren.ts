import { QueryList } from "@/core/query-list";
import type { ProviderToken } from "@/core/viewChild";

export interface ViewChildrenOptions {
  readonly debugName?: string;
}

export interface ViewChildrenReadOptions<T> extends ViewChildrenOptions {
  readonly read: ProviderToken<T>;
}

export interface ViewChildrenDecoratorOptions<T = unknown> {
  readonly read?: ProviderToken<T>;
}

export class ViewChildrenQuery<T> {
  private readonly queryList?: QueryList<T>;
  private resolvedValues: readonly T[] = [];

  constructor(
    readonly locator: ProviderToken<unknown>,
    readonly read?: ProviderToken<T>,
    readonly debugName?: string,
    asQueryList = false,
  ) {
    if (asQueryList) this.queryList = new QueryList<T>();
  }

  get value(): readonly T[] | QueryList<T> {
    return this.queryList ?? this.resolvedValues;
  }

  resolve(values: readonly T[]): void {
    if (this.queryList) {
      this.queryList.reset(values);
    } else {
      this.resolvedValues = [...values];
    }
  }

  notifyOnChanges(): void {
    this.queryList?.notifyOnChanges();
  }

  destroy(): void {
    this.queryList?.destroy();
  }
}

interface ViewChildrenFunction {
  <T>(locator: ProviderToken<T>, options?: ViewChildrenOptions): readonly T[];
  <T>(locator: ProviderToken<unknown>, options: ViewChildrenReadOptions<T>): readonly T[];
}

type StandardViewChildrenFieldDecorator = <This, Value>(
  value: undefined,
  context: ClassFieldDecoratorContext<This, Value>,
) => (initialValue: Value) => Value;

type LegacyViewChildrenFieldDecorator = (target: object, propertyKey: string | symbol) => void;

interface DecoratedViewChildrenDefinition {
  readonly locator: ProviderToken<unknown>;
  readonly options?: ViewChildrenDecoratorOptions;
}

export interface DecoratedViewChildrenQuery {
  readonly propertyKey: string | symbol;
  readonly query: ViewChildrenQuery<unknown>;
}

const decoratedQueries = new WeakMap<object, Map<string | symbol, DecoratedViewChildrenDefinition>>();

function createViewChildrenQuery<T>(
  locator: ProviderToken<unknown>,
  options:
    | {
        readonly debugName?: string;
        readonly read?: ProviderToken<T>;
      }
    | undefined,
  asQueryList = false,
): ViewChildrenQuery<T> {
  const read = options && "read" in options ? options.read : undefined;
  return new ViewChildrenQuery<T>(locator, read, options?.debugName, asQueryList);
}

const viewChildrenFactory = <T>(
  locator: ProviderToken<unknown>,
  options?: ViewChildrenOptions | ViewChildrenReadOptions<T>,
): readonly T[] => createViewChildrenQuery<T>(locator, options) as unknown as readonly T[];

export const viewChildren = viewChildrenFactory as ViewChildrenFunction;

export function ViewChildren(
  locator: ProviderToken<unknown>,
  options?: ViewChildrenDecoratorOptions,
): StandardViewChildrenFieldDecorator & LegacyViewChildrenFieldDecorator {
  const decorator = (
    valueOrTarget: undefined | object,
    contextOrProperty: ClassFieldDecoratorContext<unknown, unknown> | string | symbol,
  ) => {
    if (typeof contextOrProperty === "object") {
      return <Value>(_initialValue: Value): Value =>
        createViewChildrenQuery(locator, options, true) as unknown as Value;
    }

    const target = valueOrTarget as object;
    const definitions = decoratedQueries.get(target);
    const definition: DecoratedViewChildrenDefinition = { locator, options };

    if (definitions) {
      definitions.set(contextOrProperty, definition);
    } else {
      decoratedQueries.set(target, new Map([[contextOrProperty, definition]]));
    }
  };

  return decorator as StandardViewChildrenFieldDecorator & LegacyViewChildrenFieldDecorator;
}

export function createDecoratedViewChildrenQueries(controller: object): readonly DecoratedViewChildrenQuery[] {
  const queries: DecoratedViewChildrenQuery[] = [];
  const capturedProperties = new Set<string | symbol>();
  let prototype = Object.getPrototypeOf(controller) as object | null;

  while (prototype) {
    const definitions = decoratedQueries.get(prototype);

    if (definitions) {
      for (const [propertyKey, definition] of definitions) {
        if (capturedProperties.has(propertyKey)) continue;

        capturedProperties.add(propertyKey);
        queries.push({
          propertyKey,
          query: createViewChildrenQuery(definition.locator, definition.options, true),
        });
      }
    }

    prototype = Object.getPrototypeOf(prototype) as object | null;
  }

  return queries;
}
