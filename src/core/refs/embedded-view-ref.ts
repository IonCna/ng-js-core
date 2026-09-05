import type { IScope, ITranscludeFunction } from "angular";
import { ViewRef, ViewRefImpl } from "@/core/refs/view-ref.ts";

/** Forma del contexto que expone una vista embebida — `$implicit` + variables con nombre (`let-x="..."`, etapa 8). */
export interface ContextObject {
  $implicit?: unknown;
  [key: string]: unknown;
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
 * `$transclude(scope, cloneAttachFn)` clona el template contra un scope
 * nuevo — acá se le pasa un `cloneAttachFn` no-op para desconectar el clon
 * del DOM apenas se crea (nadie lo pidió insertar todavía, eso es trabajo de
 * `ViewContainerRef.insert`), y se guardan sus nodos raíz sueltos.
 */
export class EmbeddedViewRefImpl<C = ContextObject> extends ViewRefImpl implements EmbeddedViewRef<C> {
  public override readonly rootNodes: Node[] = [];
  private readonly compiled: JQLite;

  constructor(
    public context: C,
    $scope: IScope,
    $transclude: ITranscludeFunction,
  ) {
    super($scope);

    const clone = $transclude(this.scope, () => undefined);
    this.compiled = clone.contents();
    this.rootNodes = Array.from(this.compiled) as Node[];

    for (const node of this.rootNodes) {
      node.parentNode?.removeChild(node);
    }

    clone.remove();
  }

  public override destroy(): void {
    this.compiled.remove();
    super.destroy();
  }
}
