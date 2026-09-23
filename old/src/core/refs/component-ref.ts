import type angular from "angular";
import { ChangeDetectorRef } from "@/core/change-detection/change-detector-ref.ts";
import type { ElementRef } from "@/core/refs/element-ref.ts";
import type { ViewRef } from "@/core/refs/view-ref.ts";

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
  private readonly destroyCallbacks = new Set<() => void>();
  private destroyed = false;
  private readonly inputValues = new Map<string, unknown>();

  constructor(
    public readonly location: ElementRef<HTMLElement>,
    public readonly instance: C,
    public readonly changeDetectorRef: ChangeDetectorRef,
    public readonly hostView: ViewRef,
    initialInputs: Readonly<Record<string, unknown>> = {},
  ) {
    super();

    for (const [name, value] of Object.entries(initialInputs)) {
      this.inputValues.set(name, value);
    }
  }

  setInput(name: string, value: unknown): void {
    if (this.destroyed) {
      throw new Error("No se puede actualizar un componente destruido");
    }

    const firstChange = !this.inputValues.has(name);
    const previousValue = this.inputValues.get(name);
    if (!firstChange && Object.is(previousValue, value)) return;

    this.inputValues.set(name, value);
    Object.assign(this.instance as object, { [name]: value });

    // `$onChanges` (no `ngOnChanges` directo): así respeta lo que haya puesto
    // ahí `lifecycle-bridge.ts` (que reenvía a `ngOnChanges` si existe), en
    // vez de acoplarse a un solo mecanismo de autoría.
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
    if (this.destroyed) return;
    this.destroyed = true;

    const callbacks = [...this.destroyCallbacks];
    this.destroyCallbacks.clear();

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
    if (!this.destroyed) this.destroyCallbacks.add(callback);
  }
}
