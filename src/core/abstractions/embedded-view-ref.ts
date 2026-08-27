import type { IScope, ITranscludeFunction } from "angular";
import type { ContextObject } from "@/core/abstractions/context-object";
import { ViewRef, ViewRefImpl } from "@/core/abstractions/view-ref";

export abstract class EmbeddedViewRef<C = ContextObject> extends ViewRef {
  abstract context: C;
  abstract readonly rootNodes: Node[];
  abstract override destroy(): void;
  abstract override readonly destroyed: boolean;
  abstract override onDestroy(callback: () => void): void;
  abstract override markForCheck(): void;
  abstract override detectChanges(): void;
}

export class EmbeddedViewRefImpl<C = ContextObject> extends ViewRefImpl implements EmbeddedViewRef<C> {
  public override readonly rootNodes: Node[] = [];
  private compiled: JQLite;

  constructor(
    public context: C,
    $scope: IScope,
    $transclude: ITranscludeFunction,
  ) {
    super($scope);

    const clone = $transclude(this.scope, () => undefined);
    this.compiled = clone.contents();
    this.rootNodes = Array.from(this.compiled);

    for (const node of this.rootNodes) {
      node.parentNode?.removeChild(node);
    }

    clone.remove();
  }

  public override destroy() {
    this.compiled.remove();
    super.destroy();
  }
}
