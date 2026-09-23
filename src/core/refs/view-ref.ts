import type { IScope } from "angular";
import { ChangeDetectorRef, ChangeDetectorRefImpl } from "@/core/change-detection/change-detector-ref.ts";

export abstract class ViewRef extends ChangeDetectorRef {
  abstract destroy(): void;
  abstract readonly destroyed: boolean;
  abstract onDestroy(callback: () => void): void;
  abstract override markForCheck(): void;
  abstract override detectChanges(): void;
  abstract override detach(): void;
  abstract override reattach(): void;
}

export class ViewRefImpl extends ChangeDetectorRefImpl implements ViewRef {
  private _destroyed = false;
  private readonly callbacks = new Set<() => void>();

  constructor(
    $scope: IScope,
    public readonly rootNodes: readonly Node[] = [],
  ) {
    super($scope);
  }

  get destroyed(): boolean {
    return this._destroyed;
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    let firstError: unknown;
    for (const callback of this.callbacks) {
      try {
        callback();
      } catch (error) {
        firstError ??= error;
      }
    }
    this.callbacks.clear();

    for (const node of this.rootNodes) node.parentNode?.removeChild(node);

    this.scope.$destroy();

    if (firstError) throw firstError;
  }

  onDestroy(callback: () => void): void {
    if (!this._destroyed) this.callbacks.add(callback);
  }
}
