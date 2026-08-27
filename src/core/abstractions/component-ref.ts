import type angular from "angular";
import type { ChangeDetectorRef } from "@/core/abstractions/change-detector-ref";
import type { ElementRef } from "@/core/abstractions/element-ref";
import type { ViewRef } from "@/core/abstractions/view-ref";

export abstract class ComponentRef<C> {
  abstract setInput(name: string, value: unknown): void;
  abstract readonly location: ElementRef<HTMLElement>;
  abstract readonly instance: C;
  abstract readonly hostView: ViewRef;
  abstract readonly changeDetectorRef: ChangeDetectorRef;
  abstract destroy(): void;
  abstract onDestroy(callback: () => void): void;
}

export class ComponentRefImpl<C = unknown> extends ComponentRef<C> {
  private _destroyCallbacks = new Set<() => void>();
  private _destroyed = false;
  private readonly _inputValues = new Map<string, unknown>();

  constructor(
    public location: ElementRef<HTMLElement>,
    public instance: C,
    public changeDetectorRef: ChangeDetectorRef,
    public hostView: ViewRef,
    initialInputs: Readonly<Record<string, unknown>> = {},
  ) {
    super();

    for (const [name, value] of Object.entries(initialInputs)) {
      this._inputValues.set(name, value);
    }
  }

  setInput(name: string, value: unknown): void {
    if (this._destroyed) {
      throw new Error("No se puede actualizar un componente destruido");
    }

    const firstChange = !this._inputValues.has(name);
    const previousValue = this._inputValues.get(name);
    if (!firstChange && Object.is(previousValue, value)) return;

    this._inputValues.set(name, value);
    Object.assign(this.instance as object, {
      [name]: value,
    });

    const controller = this.instance as C & Partial<angular.IComponentController>;
    controller.$onChanges?.({
      [name]: {
        currentValue: value,
        previousValue,
        isFirstChange: () => firstChange,
      },
    });

    this.changeDetectorRef.markForCheck();
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    const callbacks = [...this._destroyCallbacks];
    this._destroyCallbacks.clear();

    let firstError: unknown;
    for (const callback of callbacks) {
      try {
        callback();
      } catch (error) {
        firstError ??= error;
      }
    }

    try {
      this.hostView.destroy();
    } catch (error) {
      firstError ??= error;
    }

    if (firstError) throw firstError;
  }

  onDestroy(callback: () => void): void {
    if (!this._destroyed) this._destroyCallbacks.add(callback);
  }
}
