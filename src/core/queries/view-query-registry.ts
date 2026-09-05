import type { ContentChildQuery } from "@/core/queries/content-child.ts";
import type { ContentChildrenQuery } from "@/core/queries/content-children.ts";
import type { QueryToken } from "@/core/queries/query-types.ts";
import type { ViewChildQuery } from "@/core/queries/view-child.ts";
import type { ViewChildrenQuery } from "@/core/queries/view-children.ts";

interface Candidate {
  /** Vacío para candidatos de `ng-ref` (no publican por clase, publican por `locator`). */
  tokens: readonly QueryToken<unknown>[];
  /** String real (`ng-ref="nombre"`) — ausente en los candidatos automáticos por clase. */
  locator?: string;
  value: unknown;
}

interface QueryLike {
  readonly locator: QueryToken<unknown>;
}

function matches(query: QueryLike, candidate: Candidate): boolean {
  return typeof query.locator === "string" ? candidate.locator === query.locator : candidate.tokens.includes(query.locator);
}

/**
 * Uno por controller instanciado (creado en `ng-ref-bridge.ts`). Junta las
 * queries QUE declaró ese controller (`queries`/`childrenQueries` para
 * `@ViewChild(ren)`, `contentQueries`/`contentChildrenQueries` para
 * `@ContentChild(ren)`) y los candidatos que le fueron publicando — de vista
 * (`candidates`, automático vía `$scope.$parent`, o por `ng-ref="nombre"`) o
 * de contenido (`contentCandidates`, requiere el binding de `<ng-content>`,
 * ver `query-context.ts`). `resolve()` se llama en `$postLink`, cuando ya
 * está garantizado que todos los hijos terminaron de publicarse. Sin orden
 * de documento todavía: los candidatos quedan en el orden en que se
 * construyeron/linkearon.
 */
export class ViewQueryRegistry {
  private readonly queries: ViewChildQuery<unknown>[] = [];
  private readonly childrenQueries: ViewChildrenQuery<unknown>[] = [];
  private readonly contentQueries: ContentChildQuery<unknown>[] = [];
  private readonly contentChildrenQueries: ContentChildrenQuery<unknown>[] = [];
  private readonly candidates: Candidate[] = [];
  private readonly contentCandidates: Candidate[] = [];

  get hasContentQueries(): boolean {
    return this.contentQueries.length > 0 || this.contentChildrenQueries.length > 0;
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

  registerCandidate(tokens: readonly QueryToken<unknown>[], value: unknown): void {
    this.candidates.push({ tokens, value });
  }

  registerContentCandidate(tokens: readonly QueryToken<unknown>[], value: unknown): void {
    this.contentCandidates.push({ tokens, value });
  }

  /** `ng-ref="nombre"` — publica por locator string, no por clase (ver `ng-ref-bridge.ts`). */
  registerNamedCandidate(locator: string, value: unknown): void {
    this.candidates.push({ tokens: [], locator, value });
  }

  registerNamedContentCandidate(locator: string, value: unknown): void {
    this.contentCandidates.push({ tokens: [], locator, value });
  }

  resolve(): void {
    for (const query of this.queries) {
      const match = this.candidates.find((candidate) => matches(query, candidate));
      if (match) query.resolve(match.value);
      else query.reset();
    }

    for (const query of this.childrenQueries) {
      const found = this.candidates.filter((candidate) => matches(query, candidate));
      query.resolve(found.map((candidate) => candidate.value));
    }

    for (const query of this.contentQueries) {
      const match = this.contentCandidates.find((candidate) => matches(query, candidate));
      if (match) query.resolve(match.value);
      else query.reset();
    }

    for (const query of this.contentChildrenQueries) {
      const found = this.contentCandidates.filter((candidate) => matches(query, candidate));
      query.resolve(found.map((candidate) => candidate.value));
    }
  }

  /** Llamar en `$scope.$on('$destroy', ...)` — completa el `changes` de cada `QueryList` viva. */
  destroy(): void {
    for (const query of this.childrenQueries) query.destroy();
    for (const query of this.contentChildrenQueries) query.destroy();
  }
}
