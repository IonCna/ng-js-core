import type { IAugmentedJQuery, IControllerService, IScope } from "angular";
import { ChangeDetectorRef } from "@/core/change-detector-ref";
import { ContentChildQuery, createDecoratedContentChildQueries } from "@/core/contentChild";
import { ContentChildrenQuery, createDecoratedContentChildrenQueries } from "@/core/contentChildren";
import { createDecoratedViewChildQueries, type ProviderToken, ViewChildQuery } from "@/core/viewChild";
import { createDecoratedViewChildrenQueries, ViewChildrenQuery } from "@/core/viewChildren";

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

interface QueryReference {
  readonly locator: ProviderToken<unknown>;
  readonly read?: ProviderToken<unknown>;
}

function queryAcceptsReference(
  query: QueryReference,
  locator: string,
  candidates: ReadonlyMap<ProviderToken<unknown>, unknown>,
): boolean {
  const matchesLocator = typeof query.locator === "string" ? query.locator === locator : candidates.has(query.locator);
  return matchesLocator || (query.read !== undefined && candidates.has(query.read));
}

function sortReferencesByDocumentOrder(references: readonly ViewReference[]): ViewReference[] {
  return references
    .map((reference, index) => ({ index, reference }))
    .sort((left, right) => {
      const leftNode = left.reference.node;
      const rightNode = right.reference.node;
      if (!leftNode || !rightNode || leftNode === rightNode) return left.index - right.index;

      const position = leftNode.compareDocumentPosition(rightNode);
      if (position & 1) return left.index - right.index;
      if (position & 4) return -1;
      if (position & 2) return 1;
      return left.index - right.index;
    })
    .map(({ reference }) => reference);
}

const controllerRegistries = new WeakMap<object, ViewQueryRegistry>();
const scopeRegistries = new WeakMap<IScope, ViewQueryRegistry[]>();
const activeRegistries: ViewQueryRegistry[] = [];
const contentOwnersByScope = new WeakMap<IScope, readonly ViewQueryRegistry[]>();
const activeContentOwners: Array<readonly ViewQueryRegistry[]> = [];

function isObject(value: unknown): value is object {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

function createControllerLocals(locals?: ControllerLocals): ControllerLocals | undefined {
  if (!locals?.$scope || Object.hasOwn(locals, ChangeDetectorRef.$name)) return locals;

  return {
    ...locals,
    [ChangeDetectorRef.$name]: new ChangeDetectorRef(locals.$scope),
  };
}

function getControllerTokens(controller: object): readonly ProviderToken<unknown>[] {
  const tokens: ProviderToken<unknown>[] = [];
  const capturedTokens = new Set<ProviderToken<unknown>>();
  let prototype = Object.getPrototypeOf(controller) as { constructor?: ProviderToken<unknown> } | null;

  while (prototype && prototype !== Object.prototype) {
    const token = prototype.constructor;
    if (token && !capturedTokens.has(token)) {
      capturedTokens.add(token);
      tokens.push(token);
    }

    prototype = Object.getPrototypeOf(prototype) as { constructor?: ProviderToken<unknown> } | null;
  }

  return tokens;
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
  private readonly viewChildrenQueries: ViewChildrenQuery<unknown>[] = [];
  private readonly references: ViewReference[] = [];
  private readonly contentQueries: ContentChildQuery<unknown>[] = [];
  private readonly contentChildrenQueries: ContentChildrenQuery<unknown>[] = [];
  private readonly contentReferences: ViewReference[] = [];
  private readonly contentRoots = new Set<Node>();
  private readonly disconnectFromOwners: Array<() => void> = [];
  private queryListChangesScheduled = false;

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
    this.captureViewChildrenQueries(controller);
    this.captureContentChildQueries(controller);
    this.captureContentChildrenQueries(controller);
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
      for (const query of this.viewChildrenQueries) query.destroy();
      for (const query of this.contentChildrenQueries) query.destroy();
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
    return [...this.queries, ...this.viewChildrenQueries].some((query) =>
      queryAcceptsReference(query, locator, candidates),
    );
  }

  get hasContentQueries(): boolean {
    return this.contentQueries.length > 0 || this.contentChildrenQueries.length > 0;
  }

  acceptsContentReference(locator: string, candidates: ReadonlyMap<ProviderToken<unknown>, unknown>): boolean {
    return [...this.contentQueries, ...this.contentChildrenQueries].some((query) =>
      queryAcceptsReference(query, locator, candidates),
    );
  }

  connectReference(
    locator: string,
    defaultValue: unknown,
    candidates: ReadonlyMap<ProviderToken<unknown>, unknown>,
    node?: Node,
  ): () => void {
    const reference: ViewReference = { candidates, defaultValue, locator, node };
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
    for (const query of this.contentChildrenQueries) query.freeze();
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

  private captureViewChildrenQueries(controller: object): void {
    for (const property of Reflect.ownKeys(controller)) {
      const descriptor = Object.getOwnPropertyDescriptor(controller, property);
      if (!descriptor || !(descriptor.value instanceof ViewChildrenQuery)) continue;

      const query = descriptor.value as ViewChildrenQuery<unknown>;
      this.installViewChildrenQuery(controller, property, query, descriptor.enumerable ?? true);
    }

    for (const { propertyKey, query } of createDecoratedViewChildrenQueries(controller)) {
      this.installViewChildrenQuery(controller, propertyKey, query, true);
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

  private captureContentChildrenQueries(controller: object): void {
    for (const property of Reflect.ownKeys(controller)) {
      const descriptor = Object.getOwnPropertyDescriptor(controller, property);
      if (!descriptor || !(descriptor.value instanceof ContentChildrenQuery)) {
        continue;
      }

      const query = descriptor.value as ContentChildrenQuery<unknown>;
      this.installContentChildrenQuery(controller, property, query, descriptor.enumerable ?? true);
    }

    for (const { propertyKey, query } of createDecoratedContentChildrenQueries(controller)) {
      this.installContentChildrenQuery(controller, propertyKey, query, true);
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

  private installViewChildrenQuery(
    controller: object,
    property: PropertyKey,
    query: ViewChildrenQuery<unknown>,
    enumerable: boolean,
  ): void {
    this.viewChildrenQueries.push(query);

    Object.defineProperty(controller, property, {
      configurable: true,
      enumerable,
      get: () => query.value,
    });
  }

  private installContentChildrenQuery(
    controller: object,
    property: PropertyKey,
    query: ContentChildrenQuery<unknown>,
    enumerable: boolean,
  ): void {
    this.contentChildrenQueries.push(query);

    Object.defineProperty(controller, property, {
      configurable: true,
      enumerable,
      get: () => query.value,
    });
  }

  private wrapPostLinkForStaticQueries(controller: object): void {
    const hasStaticViewQuery = this.queries.some((query) => query.staticQuery);
    const hasStaticContentQuery = this.contentQueries.some((query) => query.staticQuery);
    const hasStaticContentChildrenQuery = this.contentChildrenQueries.some((query) => query.staticQuery);
    const hasViewChildrenQuery = this.viewChildrenQueries.length > 0;
    const hasContentChildrenQuery = this.contentChildrenQueries.length > 0;
    if (
      !hasStaticViewQuery &&
      !hasStaticContentQuery &&
      !hasStaticContentChildrenQuery &&
      !hasViewChildrenQuery &&
      !hasContentChildrenQuery
    ) {
      return;
    }

    const lifecycleController = controller as {
      $postLink?: (...args: unknown[]) => unknown;
    };
    const postLink = lifecycleController.$postLink;

    lifecycleController.$postLink = (...args: unknown[]) => {
      this.finalizeStaticViewQueries();
      this.finalizeStaticContentQueries();
      this.notifyQueryListChanges();
      return postLink?.apply(controller, args);
    };
  }

  private publishControllerToOwners(controller: object, scope: IScope): void {
    const tokens = getControllerTokens(controller);
    if (tokens.length === 0) return;

    const candidates = new Map<ProviderToken<unknown>, unknown>(tokens.map((token) => [token, controller]));
    const [node] = this.element ? Array.from(this.element) : [];
    let current: IScope | null = scope;

    while (current) {
      for (const owner of getScopeViewQueryRegistries(current)) {
        if (owner === this || !owner.acceptsReference("", candidates)) continue;

        this.disconnectFromOwners.push(owner.connectReference("", controller, candidates, node));
      }

      current = current.$parent;
    }

    for (const owner of getContentQueryOwners(scope)) {
      if (owner === this || !owner.acceptsContentReference("", candidates)) {
        continue;
      }

      this.disconnectFromOwners.push(owner.connectContentReference("", controller, candidates, node));
    }
  }

  private refreshQueries(): void {
    const orderedReferences = sortReferencesByDocumentOrder(this.references);

    for (const query of this.queries) {
      const reference = orderedReferences.find((candidate) =>
        typeof query.locator === "string"
          ? candidate.locator === query.locator
          : candidate.candidates.has(query.locator),
      );

      if (!reference) {
        query.reset();
        continue;
      }

      const readToken = query.read ?? (typeof query.locator === "string" ? undefined : query.locator);
      const value = this.readReference(reference, readToken, orderedReferences);

      if (value === undefined) {
        query.reset();
      } else {
        query.resolve(value);
      }
    }

    for (const query of this.viewChildrenQueries) {
      const readToken = query.read ?? (typeof query.locator === "string" ? undefined : query.locator);
      const matchedNodes = new Set<Node>();
      const values = orderedReferences.flatMap((candidate) => {
        const matchesLocator =
          typeof query.locator === "string"
            ? candidate.locator === query.locator
            : candidate.candidates.has(query.locator);

        if (!matchesLocator) return [];

        if (candidate.node !== undefined) {
          if (matchedNodes.has(candidate.node)) return [];
          matchedNodes.add(candidate.node);
        }

        const value = this.readReference(candidate, readToken, orderedReferences);
        return value === undefined ? [] : [value];
      });

      query.resolve(values);
    }

    this.scheduleQueryListChanges();
  }

  private refreshContentQueries(): void {
    const orderedReferences = sortReferencesByDocumentOrder(this.contentReferences);

    for (const query of this.contentQueries) {
      const reference = orderedReferences.find((candidate) => {
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
      const value = this.readReference(reference, readToken, orderedReferences);

      if (value === undefined) {
        query.reset();
      } else {
        query.resolve(value);
      }
    }

    for (const query of this.contentChildrenQueries) {
      const readToken = query.read ?? (typeof query.locator === "string" ? undefined : query.locator);
      const matchedNodes = new Set<Node>();
      const values = orderedReferences.flatMap((candidate) => {
        const matchesLocator =
          typeof query.locator === "string"
            ? candidate.locator === query.locator
            : candidate.candidates.has(query.locator);
        const matchesDepth =
          query.descendants || (candidate.node !== undefined && this.contentRoots.has(candidate.node));

        if (!matchesLocator || !matchesDepth) return [];

        if (candidate.node !== undefined) {
          if (matchedNodes.has(candidate.node)) return [];
          matchedNodes.add(candidate.node);
        }

        const value = this.readReference(candidate, readToken, orderedReferences);
        return value === undefined ? [] : [value];
      });

      query.resolve(values);
    }

    this.scheduleQueryListChanges();
  }

  private scheduleQueryListChanges(): void {
    if (
      this.queryListChangesScheduled ||
      (this.viewChildrenQueries.length === 0 && this.contentChildrenQueries.length === 0)
    ) {
      return;
    }

    this.queryListChangesScheduled = true;

    if (this.scope) {
      this.scope.$evalAsync(() => this.notifyQueryListChanges());
    } else {
      queueMicrotask(() => this.notifyQueryListChanges());
    }
  }

  private notifyQueryListChanges(): void {
    this.queryListChangesScheduled = false;
    for (const query of this.viewChildrenQueries) query.notifyOnChanges();
    for (const query of this.contentChildrenQueries) query.notifyOnChanges();
  }

  private readReference(
    reference: ViewReference,
    readToken: ProviderToken<unknown> | undefined,
    references: readonly ViewReference[],
  ): unknown {
    if (readToken === undefined) return reference.defaultValue;

    const value = reference.candidates.get(readToken);
    if (value !== undefined || reference.node === undefined) return value;

    for (const candidate of references) {
      if (candidate.node !== reference.node) continue;

      const siblingValue = candidate.candidates.get(readToken);
      if (siblingValue !== undefined) return siblingValue;
    }

    return undefined;
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
    const controllerLocals = createControllerLocals(locals);

    if (later) {
      const initializer = invokeController<T>(
        expression,
        controllerLocals,
        true,
        identifier,
      ) as ControllerInitializer<T>;
      const registry = new ViewQueryRegistry(
        controllerLocals?.$scope,
        controllerLocals?.$element,
        initializer.identifier ?? identifier,
      );

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

    const registry = new ViewQueryRegistry(controllerLocals?.$scope, controllerLocals?.$element, identifier);

    pushActiveViewQueryRegistry(registry);

    try {
      const instance = invokeController<T>(expression, controllerLocals, false, identifier) as T;

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
