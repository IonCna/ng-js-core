import type { IAugmentedJQuery, IScope } from "angular";
import { ControllerQueryState } from "@/core/queries/controller-query-state";
import { getControllerTokens } from "@/core/queries/controller-tokens";
import {
  getContentQueryOwners,
  getScopeViewQueryRegistries,
  registerControllerViewQueryRegistry,
  registerScopeViewQueryRegistry,
} from "@/core/queries/query-context";
import type { ProviderToken, QueryReference } from "@/core/queries/query-types";
import { QueryReferenceStore } from "@/core/queries/reference-store";

export interface ControllerViewMetadata {
  readonly controller: object;
  readonly element?: IAugmentedJQuery;
  readonly identifier?: string;
  readonly scope?: IScope;
}

export class ViewQueryRegistry {
  private controller?: object;
  private readonly contentReferences = new QueryReferenceStore();
  private readonly contentRoots = new Set<Node>();
  private readonly disconnectFromOwners: Array<() => void> = [];
  private queryListChangesScheduled = false;
  private readonly queryState = new ControllerQueryState();
  private readonly viewReferences = new QueryReferenceStore();

  constructor(
    private readonly scope?: IScope,
    private readonly element?: IAugmentedJQuery,
    private readonly identifier?: string,
  ) {}

  get metadata(): ControllerViewMetadata | undefined {
    if (!this.controller) return undefined;
    return { controller: this.controller, element: this.element, identifier: this.identifier, scope: this.scope };
  }

  get hasContentQueries(): boolean {
    return this.queryState.hasContentQueries;
  }

  attachController(controller: object): void {
    this.controller = controller;
    const unregisterController = registerControllerViewQueryRegistry(controller, this);
    this.queryState.attach(controller, {
      finalizeContentQueries: () => this.finalizeStaticContentQueries(),
      finalizeViewQueries: () => this.finalizeStaticViewQueries(),
      notifyChanges: () => this.notifyQueryListChanges(),
    });

    if (!this.scope) return;

    const scope = this.scope;
    const unregisterScope = registerScopeViewQueryRegistry(scope, this);
    this.publishControllerToOwners(controller, scope);

    scope.$on("$destroy", () => {
      for (const disconnect of this.disconnectFromOwners) disconnect();
      this.disconnectFromOwners.length = 0;
      this.queryState.destroy();
      unregisterController();
      unregisterScope();
    });
  }

  acceptsReference(locator: string, candidates: ReadonlyMap<ProviderToken<unknown>, unknown>): boolean {
    return this.queryState.acceptsViewReference(locator, candidates);
  }

  acceptsContentReference(locator: string, candidates: ReadonlyMap<ProviderToken<unknown>, unknown>): boolean {
    return this.queryState.acceptsContentReference(locator, candidates);
  }

  connectReference(
    locator: string,
    defaultValue: unknown,
    candidates: ReadonlyMap<ProviderToken<unknown>, unknown>,
    node?: Node,
  ): () => void {
    return this.connectToStore(this.viewReferences, { candidates, defaultValue, locator, node }, () =>
      this.refreshViewQueries(),
    );
  }

  connectContentReference(
    locator: string,
    defaultValue: unknown,
    candidates: ReadonlyMap<ProviderToken<unknown>, unknown>,
    node?: Node,
  ): () => void {
    return this.connectToStore(this.contentReferences, { candidates, defaultValue, locator, node }, () =>
      this.refreshContentQueries(),
    );
  }

  setContentRoots(nodes: readonly Node[]): void {
    for (const node of nodes) this.contentRoots.add(node);
    this.refreshContentQueries();
  }

  finalizeStaticContentQueries(): void {
    this.refreshContentQueries();
    this.queryState.freezeStaticContentQueries();
  }

  finalizeStaticViewQueries(): void {
    this.refreshViewQueries();
    this.queryState.freezeStaticViewQueries();
  }

  private connectToStore(store: QueryReferenceStore, reference: QueryReference, refresh: () => void): () => void {
    const disconnect = store.connect(reference);
    refresh();

    return () => {
      disconnect();
      refresh();
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
        if (owner !== this && owner.acceptsReference("", candidates)) {
          this.disconnectFromOwners.push(owner.connectReference("", controller, candidates, node));
        }
      }
      current = current.$parent;
    }

    for (const owner of getContentQueryOwners(scope)) {
      if (owner !== this && owner.acceptsContentReference("", candidates)) {
        this.disconnectFromOwners.push(owner.connectContentReference("", controller, candidates, node));
      }
    }
  }

  private refreshViewQueries(): void {
    this.queryState.refreshViewQueries(this.viewReferences);
    this.scheduleQueryListChanges();
  }

  private refreshContentQueries(): void {
    this.queryState.refreshContentQueries(this.contentReferences, this.contentRoots);
    this.scheduleQueryListChanges();
  }

  private scheduleQueryListChanges(): void {
    if (this.queryListChangesScheduled || !this.queryState.hasCollectionQueries) return;
    this.queryListChangesScheduled = true;

    if (this.scope) this.scope.$evalAsync(() => this.notifyQueryListChanges());
    else queueMicrotask(() => this.notifyQueryListChanges());
  }

  private notifyQueryListChanges(): void {
    this.queryListChangesScheduled = false;
    this.queryState.notifyChanges();
  }
}
