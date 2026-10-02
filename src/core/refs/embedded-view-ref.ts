import angular, { type IScope, type ITranscludeFunction } from "angular";
import { ViewRef, ViewRefImpl } from "@/core/refs/view-ref.ts";

/** Forma del contexto que expone una vista embebida — `$implicit` + variables con nombre (`let-x="..."`, etapa 8). */
export interface ContextObject {
  $implicit?: unknown;
  [key: string]: unknown;
}

/**
 * Posición del DOM donde linkear la vista embebida **en el lugar** (no detached):
 * los nodos del clon se insertan antes de `anchor` dentro de `parent` ANTES de
 * que AngularJS los linkee, así los controllers del clon resuelven DI jerárquica
 * (`inject(Ancestro)`), `require: '^^'` e `inheritedData` contra los ancestros
 * reales del DOM. Sin esto el clon se linkea en un fragmento suelto y no ve nada.
 */
export interface EmbeddedViewHost {
  parent: Node;
  anchor: Node | null;
}

export abstract class EmbeddedViewRef<C = ContextObject> extends ViewRef {
  abstract context: C;
  abstract readonly rootNodes: Node[];
  abstract override destroy(): void;
  abstract override readonly destroyed: boolean;
  abstract override onDestroy(callback: () => void): void;
  abstract override markForCheck(): void;
  abstract override detectChanges(): void;
}

/**
 * `$transclude(scope, cloneAttachFn)` clona el template contra un scope nuevo.
 *
 * - Sin `host`: `cloneAttachFn` no-op → el clon queda detached y sus nodos raíz
 *   sueltos (lo inserta después `ViewContainerRef.insert`).
 * - Con `host`: se linkea **en su posición real del DOM** (`NgTemplateOutlet`),
 *   para que la DI jerárquica del contenido proyectado funcione. El envoltorio
 *   `<ng-template>` se saca al final; sus hijos quedan en el DOM en ese lugar.
 */
export class EmbeddedViewRefImpl<C = ContextObject> extends ViewRefImpl implements EmbeddedViewRef<C> {
  private nodes: Node[] = [];
  /**
   * Sin `host`, el envoltorio clonado (detached) donde quedan los nodos raíz hasta que alguien los inserte. AngularJS
   * compila la transclusión la primera vez que se usa: un componente `templateUrl` adentro se linkea después y
   * AngularJS REEMPLAZA su nodo clonado en el padre que tenga en ese momento. Con los nodos sueltos (sin padre) el
   * reemplazo se perdía y la vista mostraba el nodo viejo, sin compilar.
   */
  private holder?: Node;

  /** Los nodos raíz actuales (como Angular: lo renderizado). Mientras sigan en el envoltorio se leen de ahí. */
  public override get rootNodes(): Node[] {
    if (this.holder?.firstChild) this.nodes = Array.from(this.holder.childNodes);
    return this.nodes;
  }

  constructor(
    public context: C,
    $scope: IScope,
    $transclude: ITranscludeFunction,
    host?: EmbeddedViewHost,
  ) {
    super($scope);

    if (host) {
      const clone = $transclude(
        this.scope,
        (cloned) => {
          for (const node of Array.from(cloned as ArrayLike<Node>)) {
            host.parent.insertBefore(node, host.anchor);
          }
        },
        angular.element(host.parent as HTMLElement),
      );
      // `clone` es el envoltorio `<ng-template>` ya linkeado y en el DOM. Se
      // suben sus hijos a la misma posición y se descarta el envoltorio.
      const wrapper = clone[0] as Node;
      this.nodes = Array.from(clone.contents() as ArrayLike<Node>) as Node[];
      for (const node of this.nodes) wrapper.parentNode?.insertBefore(node, wrapper);
      clone.remove();
      return;
    }

    const clone = $transclude(this.scope, () => undefined);
    this.holder = clone[0] as Node;
    this.nodes = Array.from(clone.contents() as ArrayLike<Node>) as Node[];
  }

  public override destroy(): void {
    for (const node of this.rootNodes) node.parentNode?.removeChild(node);
    if (this.holder) angular.element(this.holder as Element).remove();
    this.holder = undefined;
    super.destroy();
  }
}
