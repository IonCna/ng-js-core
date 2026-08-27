import type { ChangeDetectorRef } from "@/core/abstractions/change-detector-ref";
import type { ElementRef } from "@/core/abstractions/element-ref";
import type { ViewRef } from "@/core/abstractions/view-ref";

export abstract class ComponentRef<C> {
  abstract setInput(name: string, value: unknown): void;
  abstract readonly location: ElementRef<any>;
  abstract readonly instance: C;
  abstract readonly hostView: ViewRef;
  abstract readonly changeDetectorRef: ChangeDetectorRef;
  abstract destroy(): void;
  abstract onDestroy(callback: () => void): void;
}

export class ComponentRefImpl<C = any> extends ComponentRef<C> {
  private _destroyCallbacks = new Set<() => void>();

  constructor(
    public location: ElementRef<C>,
    public instance: C,
    public changeDetectorRef: ChangeDetectorRef,
    public hostView: ViewRef,
  ) {
    super();
  }

  setInput(name: string, value: unknown): void {
    Object.assign(this.instance as object, {
      [name]: value,
    });

    this.changeDetectorRef.detectChanges();
  }

  destroy(): void {
    this._destroyCallbacks.forEach((callback) => {
      callback();
    });

    this.hostView.destroy();
  }

  onDestroy(callback: () => void): void {
    this._destroyCallbacks.add(callback);
  }
}
