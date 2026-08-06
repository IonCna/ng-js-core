import type { ProviderToken } from "@/core/viewChild";

export interface ContentChildOptions {
  readonly debugName?: string;
  readonly descendants?: boolean;
}

export interface ContentChildReadOptions<T> extends ContentChildOptions {
  readonly read: ProviderToken<T>;
}

export interface ContentChildDecoratorOptions<T = unknown> {
  readonly descendants?: boolean;
  readonly read?: ProviderToken<T>;
  readonly static?: boolean;
}

export class ContentChildQuery<T> {
  private frozen = false;
  private resolvedValue: T | undefined;

  constructor(
    readonly locator: ProviderToken<unknown>,
    readonly required: boolean,
    readonly descendants: boolean,
    readonly staticQuery: boolean,
    readonly read?: ProviderToken<T>,
    readonly debugName?: string,
  ) {}

  get value(): T | undefined {
    if (this.required && this.resolvedValue === undefined) {
      const name = this.debugName ?? String(this.locator);
      throw new Error(`La consulta contentChild requerida "${name}" no tiene valor`);
    }

    return this.resolvedValue;
  }

  resolve(value: T): void {
    if (this.frozen) return;
    this.resolvedValue = value;
  }

  reset(): void {
    if (this.frozen) return;
    this.resolvedValue = undefined;
  }

  freeze(): void {
    if (this.staticQuery) this.frozen = true;
  }
}

interface RequiredContentChildFunction {
  <T>(locator: ProviderToken<T>, options?: ContentChildOptions): T;
  <T>(locator: ProviderToken<unknown>, options: ContentChildReadOptions<T>): T;
}

interface ContentChildFunction {
  <T>(locator: ProviderToken<T>, options?: ContentChildOptions): T | undefined;
  <T>(locator: ProviderToken<unknown>, options: ContentChildReadOptions<T>): T | undefined;
  readonly required: RequiredContentChildFunction;
}

type StandardContentChildFieldDecorator = <This, Value>(
  value: undefined,
  context: ClassFieldDecoratorContext<This, Value>,
) => (initialValue: Value) => Value;

type LegacyContentChildFieldDecorator = (target: object, propertyKey: string | symbol) => void;

interface DecoratedContentChildDefinition {
  readonly locator: ProviderToken<unknown>;
  readonly options?: ContentChildDecoratorOptions;
}

export interface DecoratedContentChildQuery {
  readonly propertyKey: string | symbol;
  readonly query: ContentChildQuery<unknown>;
}

const decoratedQueries = new WeakMap<object, Map<string | symbol, DecoratedContentChildDefinition>>();

function createContentChildQuery<T>(
  locator: ProviderToken<unknown>,
  options: ContentChildOptions | ContentChildReadOptions<T> | undefined,
  required: boolean,
  staticQuery = false,
): ContentChildQuery<T> {
  const read = options && "read" in options ? options.read : undefined;
  return new ContentChildQuery<T>(
    locator,
    required,
    options?.descendants ?? true,
    staticQuery,
    read,
    options?.debugName,
  );
}

function createContentChild<T>(
  locator: ProviderToken<unknown>,
  options: ContentChildOptions | ContentChildReadOptions<T> | undefined,
  required: boolean,
): T | undefined {
  return createContentChildQuery<T>(locator, options, required) as unknown as T;
}

const optionalContentChild = <T>(
  locator: ProviderToken<unknown>,
  options?: ContentChildOptions | ContentChildReadOptions<T>,
): T | undefined => createContentChild<T>(locator, options, false);

const requiredContentChild: RequiredContentChildFunction = <T>(
  locator: ProviderToken<unknown>,
  options?: ContentChildOptions | ContentChildReadOptions<T>,
): T => createContentChild<T>(locator, options, true) as T;

Object.defineProperty(optionalContentChild, "required", {
  value: requiredContentChild,
});

export const contentChild = optionalContentChild as ContentChildFunction;

export function ContentChild(
  locator: ProviderToken<unknown>,
  options?: ContentChildDecoratorOptions,
): StandardContentChildFieldDecorator & LegacyContentChildFieldDecorator {
  const decorator = (
    valueOrTarget: undefined | object,
    contextOrProperty: ClassFieldDecoratorContext<unknown, unknown> | string | symbol,
  ) => {
    if (typeof contextOrProperty === "object") {
      return <Value>(_initialValue: Value): Value =>
        createContentChildQuery(locator, options, false, options?.static ?? false) as unknown as Value;
    }

    const target = valueOrTarget as object;
    const definitions = decoratedQueries.get(target);
    const definition: DecoratedContentChildDefinition = { locator, options };

    if (definitions) {
      definitions.set(contextOrProperty, definition);
    } else {
      decoratedQueries.set(target, new Map([[contextOrProperty, definition]]));
    }
  };

  return decorator as StandardContentChildFieldDecorator & LegacyContentChildFieldDecorator;
}

export function createDecoratedContentChildQueries(controller: object): readonly DecoratedContentChildQuery[] {
  const queries: DecoratedContentChildQuery[] = [];
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
          query: createContentChildQuery(
            definition.locator,
            definition.options,
            false,
            definition.options?.static ?? false,
          ),
        });
      }
    }

    prototype = Object.getPrototypeOf(prototype) as object | null;
  }

  return queries;
}
