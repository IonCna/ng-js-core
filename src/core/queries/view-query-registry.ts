import type angular from "angular";
import type { Query } from "@/core/queries/query.ts";
import { ElementRef, ElementRefImpl } from "@/core/refs/element-ref.ts";
import { TemplateRef } from "@/core/refs/template-ref.ts";
import { ViewContainerRef, ViewContainerRefImpl } from "@/core/refs/view-container-ref.ts";

/** Algo que una query puede encontrar: una instancia (con las clases de su cadena) o un valor con nombre (`ng-ref`). */
interface Candidate {
  tokens: Function[];
  locator?: string;
  value: unknown;
  node?: Node;
}

/**
 * Las queries de UN controller y los candidatos que se le publicaron. Los hijos se publican al construirse
 * (`ng-ref-bridge.ts`); `resolve()` corre en el `$postLink` del dueño, cuando ya están todos, y de nuevo (vía
 * `onDynamicChange`) si aparecen o desaparecen candidatos después (`ng-if`/`ng-repeat`).
 */
export class ViewQueryRegistry {
  private readonly viewQueries: Query[] = [];
  private readonly contentQueries: Query[] = [];
  private readonly candidates: Candidate[] = [];
  private readonly contentCandidates: Candidate[] = [];
  private readonly contentRoots = new Set<Node>();
  private resolvedOnce = false;

  /** Reprograma un `resolve()` cuando cambian los candidatos después del primero. */
  onDynamicChange?: () => void;
  /**
   * Host de una `@Directive` sin template: su contenido es el light DOM (sin `<ng-content>` de por medio), así que
   * un candidato del mismo scope cuyo nodo esté dentro de este host es "contenido" suyo.
   */
  hostNode?: Node;
  /**
   * Host de un `@Component`: lo que se linkea en su template comparte su scope (una directiva sin scope propio),
   * así que un candidato del mismo scope cuyo nodo esté dentro de este host es de su VISTA.
   */
  componentNode?: Node;
  /** Para sintetizar un `ViewContainerRef` bajo demanda (`read: ViewContainerRef`). */
  injector?: angular.auto.IInjectorService;

  get hasContentQueries(): boolean {
    return this.contentQueries.length > 0;
  }

  /** `true` si `node` está dentro del host de este registry (y no es el host). */
  containsLightDomNode(node: Node | undefined): boolean {
    const host = this.hostNode;
    if (!host || !node || node === host) return false;
    return host.contains(node);
  }

  /** `true` si `node` está en la vista de este componente (dentro de su host, sin ser el host). */
  containsViewNode(node: Node | undefined): boolean {
    const host = this.componentNode;
    return !!host && !!node && node !== host && host.contains(node);
  }

  registerViewQuery(query: Query): void {
    this.viewQueries.push(query);
  }

  registerContentQuery(query: Query): void {
    this.contentQueries.push(query);
  }

  registerCandidate(tokens: Function[], value: unknown, node?: Node): void {
    this.candidates.push({ tokens, value, node });
    this.notifyDynamic();
  }

  registerContentCandidate(tokens: Function[], value: unknown, node?: Node): void {
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

  /** Quita todo candidato (de vista y de contenido) cuyo valor sea `value` — al destruirse el controller. */
  removeCandidate(value: unknown): void {
    const before = this.candidates.length + this.contentCandidates.length;
    ViewQueryRegistry.prune(this.candidates, value);
    ViewQueryRegistry.prune(this.contentCandidates, value);
    if (this.candidates.length + this.contentCandidates.length !== before) this.notifyDynamic();
  }

  registerContentRoots(nodes: Node[]): void {
    for (const node of nodes) this.contentRoots.add(node);
  }

  resolve(): void {
    for (const query of this.viewQueries) query.resolve(this.results(query, this.candidates, false));
    for (const query of this.contentQueries) query.resolve(this.results(query, this.contentCandidates, true));
    this.resolvedOnce = true;
  }

  destroy(): void {
    for (const query of [...this.viewQueries, ...this.contentQueries]) query.destroy();
  }

  private notifyDynamic(): void {
    if (this.resolvedOnce) this.onDynamicChange?.();
  }

  private results(query: Query, candidates: Candidate[], content: boolean): unknown[] {
    return candidates
      .filter(
        (candidate) => ViewQueryRegistry.matches(query, candidate) && (!content || this.matchesDepth(query, candidate)),
      )
      .map((candidate) => this.read(query, candidate, candidates))
      .filter((value) => value !== undefined);
  }

  /** `descendants: false` (default de `@ContentChildren`): solo los hijos directos del contenido proyectado. */
  private matchesDepth(query: Query, candidate: Candidate): boolean {
    if (query.descendants || this.contentRoots.size === 0) return true;
    return candidate.node !== undefined && this.contentRoots.has(candidate.node);
  }

  private static matches(query: Query, candidate: Candidate): boolean {
    const { predicate } = query;
    return Array.isArray(predicate)
      ? candidate.locator !== undefined && predicate.includes(candidate.locator)
      : candidate.tokens.includes(predicate);
  }

  /** `read` de la query: sin `read`, el valor del candidato; con `read`, ese token sobre el mismo elemento. */
  private read(query: Query, candidate: Candidate, siblings: Candidate[]): unknown {
    const read = query.read;
    if (!read) return candidate.value;
    if (read === ElementRef) return candidate.node ? new ElementRefImpl(candidate.node) : undefined;
    // Un `TemplateRef` como candidato, o (más abajo) el que guarda una directiva sobre el `<ng-template>`.
    if (read === TemplateRef && candidate.value instanceof TemplateRef) return candidate.value;
    if (read === ViewContainerRef) {
      if (candidate.value instanceof ViewContainerRef) return candidate.value;
      const owned = ViewQueryRegistry.ownedToken(candidate.value, ViewContainerRef);
      if (owned) return owned;
      if (candidate.node && this.injector)
        return new ViewContainerRefImpl(new ElementRefImpl(candidate.node as HTMLElement), this.injector);
      return undefined;
    }
    if (typeof read !== "function") return undefined;
    if (candidate.tokens.includes(read)) return candidate.value;
    const owned = ViewQueryRegistry.ownedToken(candidate.value, read);
    if (owned !== undefined) return owned;
    // Otra directiva sobre el mismo elemento.
    return candidate.node
      ? siblings.find(
          (sibling) => sibling !== candidate && sibling.node === candidate.node && sibling.value instanceof read,
        )?.value
      : undefined;
  }

  /** Una propiedad de `value` que es instancia de `token` (ej. el `TemplateRef` que una directiva guardó). */
  private static ownedToken(value: unknown, token: Function): unknown {
    if (!value || typeof value !== "object") return undefined;
    return Object.values(value).find((property) => property instanceof token);
  }

  private static prune(list: Candidate[], value: unknown): void {
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i]!.value === value) list.splice(i, 1);
    }
  }
}
