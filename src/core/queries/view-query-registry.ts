import type { QueryToken } from "@/core/queries/query-types.ts";
import type { ViewChildQuery } from "@/core/queries/view-child.ts";
import type { ViewChildrenQuery } from "@/core/queries/view-children.ts";

interface Candidate {
  tokens: readonly QueryToken<unknown>[];
  value: unknown;
}

/**
 * Uno por controller instanciado (creado en `ng-ref-bridge.ts`). Junta las
 * queries QUE declaró ese controller (`queries`/`childrenQueries`) y los
 * candidatos que le fueron publicando sus hijos al construirse
 * (`candidates`) — `resolve()` se llama en `$postLink`, cuando ya está
 * garantizado que todos los hijos terminaron de publicarse (AngularJS
 * linkea de abajo hacia arriba). Sin orden de documento todavía: los
 * candidatos quedan en el orden en que se construyeron sus controllers.
 */
export class ViewQueryRegistry {
  private readonly queries: ViewChildQuery<unknown>[] = [];
  private readonly childrenQueries: ViewChildrenQuery<unknown>[] = [];
  private readonly candidates: Candidate[] = [];

  registerQuery(query: ViewChildQuery<unknown>): void {
    this.queries.push(query);
  }

  registerChildrenQuery(query: ViewChildrenQuery<unknown>): void {
    this.childrenQueries.push(query);
  }

  registerCandidate(tokens: readonly QueryToken<unknown>[], value: unknown): void {
    this.candidates.push({ tokens, value });
  }

  resolve(): void {
    for (const query of this.queries) {
      const match = this.candidates.find((candidate) => candidate.tokens.includes(query.locator));
      if (match) query.resolve(match.value);
      else query.reset();
    }

    for (const query of this.childrenQueries) {
      const matches = this.candidates.filter((candidate) => candidate.tokens.includes(query.locator));
      query.resolve(matches.map((candidate) => candidate.value));
    }
  }

  /** Llamar en `$scope.$on('$destroy', ...)` — completa el `changes` de cada `QueryList` viva. */
  destroy(): void {
    for (const query of this.childrenQueries) query.destroy();
  }
}
