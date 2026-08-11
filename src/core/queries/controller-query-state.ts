import { ContentChildQuery, createDecoratedContentChildQueries } from "@/core/contentChild";
import { ContentChildrenQuery, createDecoratedContentChildrenQueries } from "@/core/contentChildren";
import { queryAcceptsReference, resolveAll, resolveFirst } from "@/core/queries/query-resolver";
import type { ProviderToken } from "@/core/queries/query-types";
import type { QueryReferenceStore } from "@/core/queries/reference-store";
import { createDecoratedViewChildQueries, ViewChildQuery } from "@/core/viewChild";
import { createDecoratedViewChildrenQueries, ViewChildrenQuery } from "@/core/viewChildren";

interface QueryLifecycle {
  finalizeContentQueries(): void;
  finalizeViewQueries(): void;
  notifyChanges(): void;
}

export class ControllerQueryState {
  private readonly contentChildrenQueries: ContentChildrenQuery<unknown>[] = [];
  private readonly contentQueries: ContentChildQuery<unknown>[] = [];
  private readonly viewChildrenQueries: ViewChildrenQuery<unknown>[] = [];
  private readonly viewQueries: ViewChildQuery<unknown>[] = [];

  get hasContentQueries(): boolean {
    return this.contentQueries.length > 0 || this.contentChildrenQueries.length > 0;
  }

  get hasCollectionQueries(): boolean {
    return this.viewChildrenQueries.length > 0 || this.contentChildrenQueries.length > 0;
  }

  attach(controller: object, lifecycle: QueryLifecycle): void {
    this.captureViewChildQueries(controller);
    this.captureViewChildrenQueries(controller);
    this.captureContentChildQueries(controller);
    this.captureContentChildrenQueries(controller);
    this.wrapPostLink(controller, lifecycle);
  }

  acceptsViewReference(locator: string, candidates: ReadonlyMap<ProviderToken<unknown>, unknown>): boolean {
    return [...this.viewQueries, ...this.viewChildrenQueries].some((query) =>
      queryAcceptsReference(query, locator, candidates),
    );
  }

  acceptsContentReference(locator: string, candidates: ReadonlyMap<ProviderToken<unknown>, unknown>): boolean {
    return [...this.contentQueries, ...this.contentChildrenQueries].some((query) =>
      queryAcceptsReference(query, locator, candidates),
    );
  }

  refreshViewQueries(store: QueryReferenceStore): void {
    for (const query of this.viewQueries) {
      const value = resolveFirst(query, store);
      if (value === undefined) query.reset();
      else query.resolve(value);
    }

    for (const query of this.viewChildrenQueries) {
      query.resolve(resolveAll(query, store));
    }
  }

  refreshContentQueries(store: QueryReferenceStore, contentRoots: ReadonlySet<Node>): void {
    for (const query of this.contentQueries) {
      const value = resolveFirst(query, store, contentRoots);
      if (value === undefined) query.reset();
      else query.resolve(value);
    }

    for (const query of this.contentChildrenQueries) {
      query.resolve(resolveAll(query, store, contentRoots));
    }
  }

  freezeStaticViewQueries(): void {
    for (const query of this.viewQueries) query.freeze();
  }

  freezeStaticContentQueries(): void {
    for (const query of this.contentQueries) query.freeze();
    for (const query of this.contentChildrenQueries) query.freeze();
  }

  notifyChanges(): void {
    for (const query of this.viewChildrenQueries) query.notifyOnChanges();
    for (const query of this.contentChildrenQueries) query.notifyOnChanges();
  }

  destroy(): void {
    for (const query of this.viewChildrenQueries) query.destroy();
    for (const query of this.contentChildrenQueries) query.destroy();
  }

  private captureViewChildQueries(controller: object): void {
    for (const property of Reflect.ownKeys(controller)) {
      const descriptor = Object.getOwnPropertyDescriptor(controller, property);
      if (!descriptor || !(descriptor.value instanceof ViewChildQuery)) continue;
      this.installQuery(controller, property, descriptor.value, this.viewQueries, descriptor.enumerable ?? true);
    }

    for (const { propertyKey, query } of createDecoratedViewChildQueries(controller)) {
      this.installQuery(controller, propertyKey, query, this.viewQueries, true);
    }
  }

  private captureViewChildrenQueries(controller: object): void {
    for (const property of Reflect.ownKeys(controller)) {
      const descriptor = Object.getOwnPropertyDescriptor(controller, property);
      if (!descriptor || !(descriptor.value instanceof ViewChildrenQuery)) continue;
      this.installQuery(
        controller,
        property,
        descriptor.value,
        this.viewChildrenQueries,
        descriptor.enumerable ?? true,
      );
    }

    for (const { propertyKey, query } of createDecoratedViewChildrenQueries(controller)) {
      this.installQuery(controller, propertyKey, query, this.viewChildrenQueries, true);
    }
  }

  private captureContentChildQueries(controller: object): void {
    for (const property of Reflect.ownKeys(controller)) {
      const descriptor = Object.getOwnPropertyDescriptor(controller, property);
      if (!descriptor || !(descriptor.value instanceof ContentChildQuery)) continue;
      this.installQuery(controller, property, descriptor.value, this.contentQueries, descriptor.enumerable ?? true);
    }

    for (const { propertyKey, query } of createDecoratedContentChildQueries(controller)) {
      this.installQuery(controller, propertyKey, query, this.contentQueries, true);
    }
  }

  private captureContentChildrenQueries(controller: object): void {
    for (const property of Reflect.ownKeys(controller)) {
      const descriptor = Object.getOwnPropertyDescriptor(controller, property);
      if (!descriptor || !(descriptor.value instanceof ContentChildrenQuery)) continue;
      this.installQuery(
        controller,
        property,
        descriptor.value,
        this.contentChildrenQueries,
        descriptor.enumerable ?? true,
      );
    }

    for (const { propertyKey, query } of createDecoratedContentChildrenQueries(controller)) {
      this.installQuery(controller, propertyKey, query, this.contentChildrenQueries, true);
    }
  }

  private installQuery<T extends { readonly value: unknown }>(
    controller: object,
    property: PropertyKey,
    query: T,
    collection: T[],
    enumerable: boolean,
  ): void {
    collection.push(query);
    Object.defineProperty(controller, property, {
      configurable: true,
      enumerable,
      get: () => query.value,
    });
  }

  private wrapPostLink(controller: object, lifecycle: QueryLifecycle): void {
    const requiresPostLink =
      this.viewQueries.some((query) => query.staticQuery) ||
      this.contentQueries.some((query) => query.staticQuery) ||
      this.contentChildrenQueries.some((query) => query.staticQuery) ||
      this.hasCollectionQueries;
    if (!requiresPostLink) return;

    const lifecycleController = controller as { $postLink?: (...args: unknown[]) => unknown };
    const postLink = lifecycleController.$postLink;

    lifecycleController.$postLink = (...args: unknown[]) => {
      lifecycle.finalizeViewQueries();
      lifecycle.finalizeContentQueries();
      lifecycle.notifyChanges();
      return postLink?.apply(controller, args);
    };
  }
}
