import type { IAugmentedJQuery, IControllerService, IScope } from "angular";
import { createDecoratedViewChildQueries, type ProviderToken, ViewChildQuery } from "@/core/viewChild";

type ControllerExpression = unknown;

interface ControllerLocals {
  $element?: IAugmentedJQuery;
  $scope?: IScope;
  [name: string]: unknown;
}

interface ControllerInitializer<T = unknown> {
  (): T;
  instance: T;
  identifier?: string;
}

type InternalControllerService = <T = unknown>(
  expression: ControllerExpression,
  locals?: ControllerLocals,
  later?: boolean,
  identifier?: string,
) => T | ControllerInitializer<T>;

export interface ControllerViewMetadata {
  readonly controller: object;
  readonly element?: IAugmentedJQuery;
  readonly identifier?: string;
  readonly scope?: IScope;
}

interface ViewReference {
  readonly candidates: ReadonlyMap<ProviderToken<unknown>, unknown>;
  readonly defaultValue: unknown;
  readonly locator: string;
}

const controllerRegistries = new WeakMap<object, ViewQueryRegistry>();
const scopeRegistries = new WeakMap<IScope, ViewQueryRegistry[]>();
const activeRegistries: ViewQueryRegistry[] = [];

function isObject(value: unknown): value is object {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

function pushActiveViewQueryRegistry(registry: ViewQueryRegistry): void {
  activeRegistries.push(registry);
}

function popActiveViewQueryRegistry(registry: ViewQueryRegistry): void {
  const index = activeRegistries.lastIndexOf(registry);

  if (index !== -1) {
    activeRegistries.splice(index, 1);
  }
}

export function getActiveViewQueryRegistry(): ViewQueryRegistry | undefined {
  return activeRegistries.at(-1);
}

export function getControllerViewQueryRegistry(controller: object): ViewQueryRegistry | undefined {
  return controllerRegistries.get(controller);
}

export function getScopeViewQueryRegistry(scope: IScope): ViewQueryRegistry | undefined {
  return scopeRegistries.get(scope)?.at(-1);
}

export function getScopeViewQueryRegistries(scope: IScope): readonly ViewQueryRegistry[] {
  return scopeRegistries.get(scope) ?? [];
}

export class ViewQueryRegistry {
  private controller?: object;
  private readonly queries: ViewChildQuery<unknown>[] = [];
  private readonly references: ViewReference[] = [];
  private readonly disconnectFromOwners: Array<() => void> = [];

  constructor(
    private readonly scope?: IScope,
    private readonly element?: IAugmentedJQuery,
    private readonly identifier?: string,
  ) {}

  get metadata(): ControllerViewMetadata | undefined {
    if (!this.controller) {
      return undefined;
    }

    return {
      controller: this.controller,
      element: this.element,
      identifier: this.identifier,
      scope: this.scope,
    };
  }

  attachController(controller: object): void {
    this.controller = controller;
    controllerRegistries.set(controller, this);
    this.captureViewChildQueries(controller);

    if (!this.scope) {
      return;
    }

    const scope = this.scope;
    const registries = scopeRegistries.get(scope);
    if (registries) {
      registries.push(this);
    } else {
      scopeRegistries.set(scope, [this]);
    }

    this.publishControllerToOwners(controller, scope);

    scope.$on("$destroy", () => {
      for (const disconnect of this.disconnectFromOwners) disconnect();
      this.disconnectFromOwners.length = 0;
      controllerRegistries.delete(controller);

      const currentRegistries = scopeRegistries.get(scope);
      if (!currentRegistries) return;

      const index = currentRegistries.indexOf(this);
      if (index !== -1) currentRegistries.splice(index, 1);

      if (currentRegistries.length === 0) {
        scopeRegistries.delete(scope);
      }
    });
  }

  acceptsReference(locator: string, candidates: ReadonlyMap<ProviderToken<unknown>, unknown>): boolean {
    return this.queries.some((query) =>
      typeof query.locator === "string" ? query.locator === locator : candidates.has(query.locator),
    );
  }

  connectReference(
    locator: string,
    defaultValue: unknown,
    candidates: ReadonlyMap<ProviderToken<unknown>, unknown>,
  ): () => void {
    const reference: ViewReference = { candidates, defaultValue, locator };
    this.references.push(reference);
    this.refreshQueries();

    return () => {
      const index = this.references.indexOf(reference);
      if (index === -1) return;

      this.references.splice(index, 1);
      this.refreshQueries();
    };
  }

  private captureViewChildQueries(controller: object): void {
    for (const property of Reflect.ownKeys(controller)) {
      const descriptor = Object.getOwnPropertyDescriptor(controller, property);
      if (!descriptor || !(descriptor.value instanceof ViewChildQuery)) continue;

      const query = descriptor.value as ViewChildQuery<unknown>;
      this.installViewChildQuery(controller, property, query, descriptor.enumerable ?? true);
    }

    for (const { propertyKey, query } of createDecoratedViewChildQueries(controller)) {
      this.installViewChildQuery(controller, propertyKey, query, true);
    }
  }

  private installViewChildQuery(
    controller: object,
    property: PropertyKey,
    query: ViewChildQuery<unknown>,
    enumerable: boolean,
  ): void {
    this.queries.push(query);

    Object.defineProperty(controller, property, {
      configurable: true,
      enumerable,
      get: () => query.value,
    });
  }

  private publishControllerToOwners(controller: object, scope: IScope): void {
    const prototype = Object.getPrototypeOf(controller) as { constructor?: ProviderToken<unknown> } | null;
    const token = prototype?.constructor;
    if (!token) return;

    const candidates = new Map<ProviderToken<unknown>, unknown>([[token, controller]]);
    let current: IScope | null = scope;

    while (current) {
      for (const owner of getScopeViewQueryRegistries(current)) {
        if (owner === this || !owner.acceptsReference("", candidates)) continue;

        this.disconnectFromOwners.push(owner.connectReference("", controller, candidates));
      }

      current = current.$parent;
    }
  }

  private refreshQueries(): void {
    for (const query of this.queries) {
      const reference = this.references.find((candidate) =>
        typeof query.locator === "string"
          ? candidate.locator === query.locator
          : candidate.candidates.has(query.locator),
      );

      if (!reference) {
        query.reset();
        continue;
      }

      const readToken = query.read ?? (typeof query.locator === "string" ? undefined : query.locator);
      const value = readToken ? reference.candidates.get(readToken) : reference.defaultValue;

      if (value === undefined) {
        query.reset();
      } else {
        query.resolve(value);
      }
    }
  }
}

export const decorNgController = ($delegate: IControllerService): IControllerService => {
  const invokeController = $delegate as unknown as InternalControllerService;

  const decoratedController = <T = unknown>(
    expression: ControllerExpression,
    locals?: ControllerLocals,
    later?: boolean,
    identifier?: string,
  ): T | ControllerInitializer<T> => {
    if (later) {
      const initializer = invokeController<T>(expression, locals, true, identifier) as ControllerInitializer<T>;
      const registry = new ViewQueryRegistry(locals?.$scope, locals?.$element, initializer.identifier ?? identifier);

      const decoratedInitializer = (() => {
        pushActiveViewQueryRegistry(registry);

        try {
          const instance = initializer();

          if (isObject(instance)) {
            registry.attachController(instance);
          }

          return instance;
        } finally {
          popActiveViewQueryRegistry(registry);
        }
      }) as ControllerInitializer<T>;

      Object.defineProperty(decoratedInitializer, "instance", {
        get: () => initializer.instance,
        set: (value: T) => {
          initializer.instance = value;
        },
      });

      Object.defineProperty(decoratedInitializer, "identifier", {
        get: () => initializer.identifier,
      });

      return decoratedInitializer;
    }

    const registry = new ViewQueryRegistry(locals?.$scope, locals?.$element, identifier);

    pushActiveViewQueryRegistry(registry);

    try {
      const instance = invokeController<T>(expression, locals, false, identifier) as T;

      if (isObject(instance)) {
        registry.attachController(instance);
      }

      return instance;
    } finally {
      popActiveViewQueryRegistry(registry);
    }
  };

  return decoratedController as IControllerService;
};

decorNgController.$inject = ["$delegate"];
