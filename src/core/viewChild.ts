export type ProviderToken<T> = string | { readonly prototype: T };

export interface ViewChildOptions {
  readonly debugName?: string;
}

export interface ViewChildReadOptions<T> extends ViewChildOptions {
  readonly read: ProviderToken<T>;
}

export interface ViewChildDecoratorOptions<T = unknown> {
  readonly read?: ProviderToken<T>;
  readonly static?: boolean;
}

export class ViewChildQuery<T> {
  private frozen = false;
  private resolvedValue: T | undefined;

  constructor(
    readonly locator: ProviderToken<unknown>,
    readonly required: boolean,
    readonly staticQuery: boolean,
    readonly read?: ProviderToken<T>,
    readonly debugName?: string,
  ) {}

  get value(): T | undefined {
    if (this.required && this.resolvedValue === undefined) {
      const name = this.debugName ?? String(this.locator);
      throw new Error(`La consulta viewChild requerida "${name}" no tiene valor`);
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

  clear(value: T): void {
    if (this.resolvedValue === value) {
      this.resolvedValue = undefined;
    }
  }
}

interface RequiredViewChildFunction {
  <T>(locator: ProviderToken<T>, options?: ViewChildOptions): T;
  <T>(locator: ProviderToken<unknown>, options: ViewChildReadOptions<T>): T;
}

interface ViewChildFunction {
  <T>(locator: ProviderToken<T>, options?: ViewChildOptions): T | undefined;
  <T>(locator: ProviderToken<unknown>, options: ViewChildReadOptions<T>): T | undefined;
  readonly required: RequiredViewChildFunction;
}

type StandardViewChildFieldDecorator = <This, Value>(
  value: undefined,
  context: ClassFieldDecoratorContext<This, Value>,
) => (initialValue: Value) => Value;

type LegacyViewChildFieldDecorator = (target: object, propertyKey: string | symbol) => void;

interface DecoratedViewChildDefinition {
  readonly locator: ProviderToken<unknown>;
  readonly options?: ViewChildDecoratorOptions;
}

interface ViewChildQueryCreationOptions<T> {
  readonly debugName?: string;
  readonly read?: ProviderToken<T>;
}

export interface DecoratedViewChildQuery {
  readonly propertyKey: string | symbol;
  readonly query: ViewChildQuery<unknown>;
}

const decoratedQueries = new WeakMap<object, Map<string | symbol, DecoratedViewChildDefinition>>();

function createViewChildQuery<T>(
  locator: ProviderToken<unknown>,
  options: ViewChildQueryCreationOptions<T> | undefined,
  required: boolean,
  staticQuery = false,
): ViewChildQuery<T> {
  const read = options && "read" in options ? options.read : undefined;
  return new ViewChildQuery<T>(locator, required, staticQuery, read, options?.debugName);
}

function createViewChild<T>(
  locator: ProviderToken<unknown>,
  options: ViewChildOptions | ViewChildReadOptions<T> | undefined,
  required: boolean,
): T | undefined {
  return createViewChildQuery<T>(locator, options, required) as unknown as T;
}

const optionalViewChild = <T>(
  locator: ProviderToken<unknown>,
  options?: ViewChildOptions | ViewChildReadOptions<T>,
): T | undefined => createViewChild<T>(locator, options, false);

const requiredViewChild: RequiredViewChildFunction = <T>(
  locator: ProviderToken<unknown>,
  options?: ViewChildOptions | ViewChildReadOptions<T>,
): T => createViewChild<T>(locator, options, true) as T;

Object.defineProperty(optionalViewChild, "required", {
  value: requiredViewChild,
});

export const viewChild = optionalViewChild as ViewChildFunction;

export function ViewChild(
  locator: ProviderToken<unknown>,
  options?: ViewChildDecoratorOptions,
): StandardViewChildFieldDecorator & LegacyViewChildFieldDecorator {
  const decorator = (
    valueOrTarget: undefined | object,
    contextOrProperty: ClassFieldDecoratorContext<unknown, unknown> | string | symbol,
  ) => {
    if (typeof contextOrProperty === "object") {
      return <Value>(_initialValue: Value): Value =>
        createViewChildQuery(locator, options, false, options?.static ?? false) as unknown as Value;
    }

    const target = valueOrTarget as object;
    const definitions = decoratedQueries.get(target);
    const definition: DecoratedViewChildDefinition = { locator, options };

    if (definitions) {
      definitions.set(contextOrProperty, definition);
    } else {
      decoratedQueries.set(target, new Map([[contextOrProperty, definition]]));
    }
  };

  return decorator as StandardViewChildFieldDecorator & LegacyViewChildFieldDecorator;
}

export function createDecoratedViewChildQueries(controller: object): readonly DecoratedViewChildQuery[] {
  const queries: DecoratedViewChildQuery[] = [];
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
          query: createViewChildQuery(
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
