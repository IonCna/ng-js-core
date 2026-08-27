import { RefImpl, Refs } from "@/core/abstractions/ref";

export abstract class ViewRef extends Refs {
  abstract destroy(): void;
  abstract readonly destroyed: boolean;
  abstract onDestroy(callback: () => void): void;
  abstract override markForCheck(): void;
  abstract override detectChanges(): void;
}

export class ViewRefImpl extends RefImpl implements ViewRef {
  private _destroyed = false;
  private _callbacks = new Set<() => void>();

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    this._callbacks.forEach((callback) => {
      callback();
    });

    this.$scope.$destroy();
  }

  get destroyed() {
    return this._destroyed;
  }

  onDestroy(callback: () => void): void {
    this._callbacks.add(callback);
  }
}
