import { QueryList } from "@/core/query-list";
import type { ProviderToken } from "@/core/viewChild";

export interface ContentChildrenOptions {
  readonly debugName?: string;
  readonly descendants?: boolean;
}

export interface ContentChildrenReadOptions<T> extends ContentChildrenOptions {
  readonly read: ProviderToken<T>;
}

export interface ContentChildrenDecoratorOptions<T = unknown> {
  readonly descendants?: boolean;
  readonly read?: ProviderToken<T>;
  readonly static?: boolean;
}

export class ContentChildrenQuery<T> {
  private frozen = false;
  private readonly queryList?: QueryList<T>;
  private resolvedValues: readonly T[] = [];

  constructor(
    readonly locator: ProviderToken<unknown>,
    readonly descendants: boolean,
    readonly staticQuery: boolean,
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
    if (this.frozen) return;

    if (this.queryList) {
      this.queryList.reset(values);
      return;
    }

    this.resolvedValues = [...values];
  }

  notifyOnChanges(): void {
    this.queryList?.notifyOnChanges();
  }

  destroy(): void {
    this.queryList?.destroy();
  }

  freeze(): void {
    if (this.staticQuery) this.frozen = true;
  }
}

interface ContentChildrenFunction {
  <T>(locator: ProviderToken<T>, options?: ContentChildrenOptions): readonly T[];
  <T>(locator: ProviderToken<unknown>, options: ContentChildrenReadOptions<T>): readonly T[];
}

type StandardContentChildrenFieldDecorator = <This, Value>(
  value: undefined,
  context: ClassFieldDecoratorContext<This, Value>,
) => (initialValue: Value) => Value;

type LegacyContentChildrenFieldDecorator = (target: object, propertyKey: string | symbol) => void;

interface DecoratedContentChildrenDefinition {
  readonly locator: ProviderToken<unknown>;
  readonly options?: ContentChildrenDecoratorOptions;
}

export interface DecoratedContentChildrenQuery {
  readonly propertyKey: string | symbol;
  readonly query: ContentChildrenQuery<unknown>;
}

const decoratedQueries = new WeakMap<object, Map<string | symbol, DecoratedContentChildrenDefinition>>();

function createContentChildrenQuery<T>(
  locator: ProviderToken<unknown>,
  options: ContentChildrenOptions | ContentChildrenReadOptions<T> | undefined,
  staticQuery = false,
  asQueryList = false,
): ContentChildrenQuery<T> {
  const read = options && "read" in options ? options.read : undefined;
  return new ContentChildrenQuery<T>(
    locator,
    options?.descendants ?? true,
    staticQuery,
    read,
    options?.debugName,
    asQueryList,
  );
}

const contentChildrenFactory = <T>(
  locator: ProviderToken<unknown>,
  options?: ContentChildrenOptions | ContentChildrenReadOptions<T>,
): readonly T[] => createContentChildrenQuery<T>(locator, options) as unknown as readonly T[];

export const contentChildren = contentChildrenFactory as ContentChildrenFunction;

export function ContentChildren(
  locator: ProviderToken<unknown>,
  options?: ContentChildrenDecoratorOptions,
): StandardContentChildrenFieldDecorator & LegacyContentChildrenFieldDecorator {
  const decorator = (
    valueOrTarget: undefined | object,
    contextOrProperty: ClassFieldDecoratorContext<unknown, unknown> | string | symbol,
  ) => {
    if (typeof contextOrProperty === "object") {
      return <Value>(_initialValue: Value): Value =>
        createContentChildrenQuery(locator, options, options?.static ?? false, true) as unknown as Value;
    }

    const target = valueOrTarget as object;
    const definitions = decoratedQueries.get(target);
    const definition: DecoratedContentChildrenDefinition = { locator, options };

    if (definitions) {
      definitions.set(contextOrProperty, definition);
    } else {
      decoratedQueries.set(target, new Map([[contextOrProperty, definition]]));
    }
  };

  return decorator as StandardContentChildrenFieldDecorator & LegacyContentChildrenFieldDecorator;
}

export function createDecoratedContentChildrenQueries(controller: object): readonly DecoratedContentChildrenQuery[] {
  const queries: DecoratedContentChildrenQuery[] = [];
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
          query: createContentChildrenQuery(
            definition.locator,
            definition.options,
            definition.options?.static ?? false,
            true,
          ),
        });
      }
    }

    prototype = Object.getPrototypeOf(prototype) as object | null;
  }

  return queries;
}
