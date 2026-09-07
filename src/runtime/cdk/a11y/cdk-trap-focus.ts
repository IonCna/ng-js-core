import type { IAttributes, IDirective } from "angular";
import { type FocusTrap, FocusTrapFactory } from "@/cdk/a11y/focus-trap.ts";
import { ElementRef } from "@/core/refs/element-ref.ts";

/**
 * `[cdkTrapFocus]` (+ `cdkTrapFocusAutoCapture`) — misma directiva que
 * `@angular/cdk/a11y`. Crea un `FocusTrap` contra su host. Con `autoCapture`,
 * al inicializar guarda el elemento con foco y enfoca el inicial; al destruirse
 * lo restaura.
 */
export class CdkTrapFocus {
  static readonly $inject = [ElementRef.$name, "$attrs", FocusTrapFactory.$name] as const;

  private focusTrap?: FocusTrap;
  private previouslyFocused: HTMLElement | null = null;

  constructor(
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly $attrs: IAttributes,
    private readonly factory: FocusTrapFactory,
  ) {}

  $postLink(): void {
    this.focusTrap = this.factory.create(this.elementRef.nativeElement, true);
    // Un tick para que el contenido proyectado / transcluido ya exista.
    Promise.resolve().then(() => {
      if (!this.focusTrap) return;
      this.focusTrap.attachAnchors();
      if (this.autoCapture) {
        this.previouslyFocused = document.activeElement as HTMLElement | null;
        this.focusTrap.focusInitialElement();
      }
    });
  }

  $onDestroy(): void {
    this.focusTrap?.destroy();
    if (this.autoCapture && typeof this.previouslyFocused?.focus === "function") {
      this.previouslyFocused.focus();
    }
  }

  private get autoCapture(): boolean {
    const raw = this.$attrs.cdkTrapFocusAutoCapture as string | undefined;
    return raw === "" || raw === "true" || raw === "cdkTrapFocusAutoCapture";
  }

  static $factory(): IDirective {
    return { restrict: "A", controller: CdkTrapFocus };
  }
}
