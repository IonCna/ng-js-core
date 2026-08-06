import type { IAugmentedJQuery, IControllerService, IScope } from "angular";
import { ContentChildQuery, createDecoratedContentChildQueries } from "@/core/contentChild";
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
  readonly node?: Node;
}

const controllerRegistries = new WeakMap<object, ViewQueryRegistry>();
const scopeRegistries = new WeakMap<IScope, ViewQueryRegistry[]>();
const activeRegistries: ViewQueryRegistry[] = [];
const contentOwnersByScope = new WeakMap<IScope, readonly ViewQueryRegistry[]>();
const activeContentOwners: Array<readonly ViewQueryRegistry[]> = [];

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

export function runWithContentQueryOwners<T>(owners: readonly ViewQueryRegistry[], callback: () => T): T {
  activeContentOwners.push(owners);

  try {
    return callback();
  } finally {
    activeContentOwners.pop();
  }
}

export function bindContentQueryOwners(scope: IScope, owners: readonly ViewQueryRegistry[]): void {
  contentOwnersByScope.set(scope, owners);

  scope.$on("$destroy", () => {
    if (contentOwnersByScope.get(scope) === owners) {
      contentOwnersByScope.delete(scope);
    }
  });
}

export function getContentQueryOwners(scope: IScope): readonly ViewQueryRegistry[] {
  const activeOwners = activeContentOwners.at(-1);
  if (activeOwners) return activeOwners;

  let current: IScope | null = scope;

  while (current) {
    const owners = contentOwnersByScope.get(current);
    if (owners) return owners;

    current = current.$parent;
  }

  return [];
}

export class ViewQueryRegistry {
  private controller?: object;
  private readonly queries: ViewChildQuery<unknown>[] = [];
  private readonly references: ViewReference[] = [];
  private readonly contentQueries: ContentChildQuery<unknown>[] = [];
  private readonly contentReferences: ViewReference[] = [];
  private readonly contentRoots = new Set<Node>();
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
    this.captureContentChildQueries(controller);
    this.wrapPostLinkForStaticQueries(controller);

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

  get hasContentQueries(): boolean {
    return this.contentQueries.length > 0;
  }

  acceptsContentReference(locator: string, candidates: ReadonlyMap<ProviderToken<unknown>, unknown>): boolean {
    return this.contentQueries.some((query) =>
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

  connectContentReference(
    locator: string,
    defaultValue: unknown,
    candidates: ReadonlyMap<ProviderToken<unknown>, unknown>,
    node?: Node,
  ): () => void {
    const reference: ViewReference = {
      candidates,
      defaultValue,
      locator,
      node,
    };
    this.contentReferences.push(reference);
    this.refreshContentQueries();

    return () => {
      const index = this.contentReferences.indexOf(reference);
      if (index === -1) return;

      this.contentReferences.splice(index, 1);
      this.refreshContentQueries();
    };
  }

  setContentRoots(nodes: readonly Node[]): void {
    for (const node of nodes) this.contentRoots.add(node);
    this.refreshContentQueries();
  }

  finalizeStaticContentQueries(): void {
    this.refreshContentQueries();
    for (const query of this.contentQueries) query.freeze();
  }

  finalizeStaticViewQueries(): void {
    this.refreshQueries();
    for (const query of this.queries) query.freeze();
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

  private captureContentChildQueries(controller: object): void {
    for (const property of Reflect.ownKeys(controller)) {
      const descriptor = Object.getOwnPropertyDescriptor(controller, property);
      if (!descriptor || !(descriptor.value instanceof ContentChildQuery)) {
        continue;
      }

      const query = descriptor.value as ContentChildQuery<unknown>;
      this.installContentChildQuery(controller, property, query, descriptor.enumerable ?? true);
    }

    for (const { propertyKey, query } of createDecoratedContentChildQueries(controller)) {
      this.installContentChildQuery(controller, propertyKey, query, true);
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

  private installContentChildQuery(
    controller: object,
    property: PropertyKey,
    query: ContentChildQuery<unknown>,
    enumerable: boolean,
  ): void {
    this.contentQueries.push(query);

    Object.defineProperty(controller, property, {
      configurable: true,
      enumerable,
      get: () => query.value,
    });
  }

  private wrapPostLinkForStaticQueries(controller: object): void {
    const hasStaticViewQuery = this.queries.some((query) => query.staticQuery);
    const hasStaticContentQuery = this.contentQueries.some((query) => query.staticQuery);
    if (!hasStaticViewQuery && !hasStaticContentQuery) return;

    const lifecycleController = controller as {
      $postLink?: (...args: unknown[]) => unknown;
    };
    const postLink = lifecycleController.$postLink;

    lifecycleController.$postLink = (...args: unknown[]) => {
      this.finalizeStaticViewQueries();
      this.finalizeStaticContentQueries();
      return postLink?.apply(controller, args);
    };
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

    const [node] = this.element ? Array.from(this.element) : [];

    for (const owner of getContentQueryOwners(scope)) {
      if (owner === this || !owner.acceptsContentReference("", candidates)) {
        continue;
      }

      this.disconnectFromOwners.push(owner.connectContentReference("", controller, candidates, node));
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

  private refreshContentQueries(): void {
    for (const query of this.contentQueries) {
      const reference = this.contentReferences.find((candidate) => {
        const matchesLocator =
          typeof query.locator === "string"
            ? candidate.locator === query.locator
            : candidate.candidates.has(query.locator);
        const matchesDepth =
          query.descendants || (candidate.node !== undefined && this.contentRoots.has(candidate.node));

        return matchesLocator && matchesDepth;
      });

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
