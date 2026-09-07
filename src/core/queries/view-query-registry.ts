import type { ContentChildQuery } from "@/core/queries/content-child.ts";
import type { ContentChildrenQuery } from "@/core/queries/content-children.ts";
import type { QueryToken } from "@/core/queries/query-types.ts";
import type { ViewChildQuery } from "@/core/queries/view-child.ts";
import type { ViewChildrenQuery } from "@/core/queries/view-children.ts";
import { ElementRef, ElementRefImpl } from "@/core/refs/element-ref.ts";
import { TemplateRef } from "@/core/refs/template-ref.ts";
import { ViewContainerRef } from "@/core/refs/view-container-ref.ts";

interface Candidate {
  tokens: readonly QueryToken<unknown>[];
  locator?: string;
  value: unknown;
  node?: Node;
}

interface QueryLike {
  readonly locator: QueryToken<unknown>;
  readonly options?: { readonly read?: QueryToken<unknown>; readonly descendants?: boolean };
}

function matches(query: QueryLike, candidate: Candidate): boolean {
  return typeof query.locator === "string" ? candidate.locator === query.locator : candidate.tokens.includes(query.locator);
}

export class ViewQueryRegistry {
  private readonly queries: ViewChildQuery<unknown>[] = [];
  private readonly childrenQueries: ViewChildrenQuery<unknown>[] = [];
  private readonly contentQueries: ContentChildQuery<unknown>[] = [];
  private readonly contentChildrenQueries: ContentChildrenQuery<unknown>[] = [];
  private readonly candidates: Candidate[] = [];
  private readonly contentCandidates: Candidate[] = [];
  private readonly contentRoots = new Set<Node>();
  private resolvedOnce = false;

  /**
   * El runtime lo setea para que un alta/baja de candidato DESPUÉS del primer
   * `resolve()` (contenido proyectado que aparece/desaparece por `ng-if`/
   * `ng-repeat`) reprograme una re-resolución — así el `QueryList` de
   * `@ContentChildren`/`@ViewChildren` emite en `.changes`, como en Angular.
   */
  onDynamicChange?: () => void;

  get hasContentQueries(): boolean {
    return this.contentQueries.length > 0 || this.contentChildrenQueries.length > 0;
  }

  private notifyDynamic(): void {
    if (this.resolvedOnce) this.onDynamicChange?.();
  }

  registerQuery(query: ViewChildQuery<unknown>): void {
    this.queries.push(query);
  }

  registerChildrenQuery(query: ViewChildrenQuery<unknown>): void {
    this.childrenQueries.push(query);
  }

  registerContentQuery(query: ContentChildQuery<unknown>): void {
    this.contentQueries.push(query);
  }

  registerContentChildrenQuery(query: ContentChildrenQuery<unknown>): void {
    this.contentChildrenQueries.push(query);
  }

  registerCandidate(tokens: readonly QueryToken<unknown>[], value: unknown, node?: Node): void {
    this.candidates.push({ tokens, value, node });
    this.notifyDynamic();
  }

  registerContentCandidate(tokens: readonly QueryToken<unknown>[], value: unknown, node?: Node): void {
    this.contentCandidates.push({ tokens, value, node });
    this.notifyDynamic();
  }

  registerNamedCandidate(locator: string, value: unknown, node?: Node): void {
    this.candidates.push({ tokens: [], locator, value, node });
    this.notifyDynamic();
  }

  registerNamedContentCandidate(locator: string, value: unknown, node?: Node): void {
    this.contentCandidates.push({ tokens: [], locator, value, node });
    this.notifyDynamic();
  }

  /** Quita todo candidato (de vista y de contenido) cuyo valor sea `value` — al destruirse el controller proyectado. */
  removeCandidate(value: unknown): void {
    const before = this.candidates.length + this.contentCandidates.length;
    prune(this.candidates, value);
    prune(this.contentCandidates, value);
    if (this.candidates.length + this.contentCandidates.length !== before) this.notifyDynamic();
  }

  registerContentRoots(nodes: Iterable<Node>): void {
    for (const node of nodes) this.contentRoots.add(node);
  }

  resolve(): void {
    for (const query of this.queries) {
      const match = this.candidates.find((candidate) => matches(query, candidate));
      if (match) query.resolve(readCandidate(query, match, this.candidates));
      else query.reset();
    }

    for (const query of this.childrenQueries) {
      const found = this.candidates.filter((candidate) => matches(query, candidate));
      query.resolve(
        found.map((candidate) => readCandidate(query, candidate, this.candidates)).filter((value) => value !== undefined),
      );
    }

    for (const query of this.contentQueries) {
      const match = this.contentCandidates.find(
        (candidate) => matches(query, candidate) && matchesContentDepth(query, candidate, this.contentRoots),
      );
      if (match) query.resolve(readCandidate(query, match, this.contentCandidates));
      else query.reset();
    }

    for (const query of this.contentChildrenQueries) {
      const found = this.contentCandidates.filter(
        (candidate) => matches(query, candidate) && matchesContentDepth(query, candidate, this.contentRoots),
      );
      query.resolve(
        found
          .map((candidate) => readCandidate(query, candidate, this.contentCandidates))
          .filter((value) => value !== undefined),
      );
    }

    this.resolvedOnce = true;
  }

  destroy(): void {
    for (const query of this.childrenQueries) query.destroy();
    for (const query of this.contentChildrenQueries) query.destroy();
  }
}

function prune(list: Candidate[], value: unknown): void {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].value === value) list.splice(i, 1);
  }
}

function matchesContentDepth(query: QueryLike, candidate: Candidate, roots: ReadonlySet<Node>): boolean {
  if (query.options?.descendants !== false || roots.size === 0) return true;
  return candidate.node !== undefined && roots.has(candidate.node);
}

function readCandidate(query: QueryLike, candidate: Candidate, siblings: readonly Candidate[] = []): unknown {
  const read = query.options?.read;
  if (!read) return candidate.value;

  if (read === ElementRef) return candidate.node ? new ElementRefImpl(candidate.node as HTMLElement) : undefined;
  if (read === TemplateRef && candidate.value instanceof TemplateRef) return candidate.value;
  if (read === ViewContainerRef && candidate.value instanceof ViewContainerRef) return candidate.value;

  if (typeof read !== "string") {
    if (candidate.tokens.includes(read)) return candidate.value;

    const owned = readOwnedToken(candidate.value, read);
    if (owned !== undefined) return owned;

    // Co-ubicado: otro candidato en el MISMO nodo cuyo valor sea del tipo `read`
    // (p.ej. `@ContentChild(MiDirectiva, { read: TemplateRef })` sobre un
    // `<ng-template mi-directiva>` — el `TemplateRef` se publica como su propio
    // candidato en ese nodo). Angular lo resuelve vía el injector del elemento.
    if (candidate.node) {
      const coLocated = siblings.find(
        (sibling) => sibling !== candidate && sibling.node === candidate.node && sibling.value instanceof (read as Function),
      );
      if (coLocated) return coLocated.value;
    }
  }

  return undefined;
}

function readOwnedToken<T>(value: unknown, token: { readonly prototype: T }): T | undefined {
  if (!value || typeof value !== "object") return undefined;

  for (const property of Object.values(value)) {
    if (property instanceof (token as Function)) return property as T;
  }

  return undefined;
}
