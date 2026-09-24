import type { FocusTrap, FocusTrapFactory } from "@/cdk/a11y/focus-trap.ts";
import type { AfterViewInit, OnDestroy } from "@/core/lifecycle/interfaces.ts";
import { Directive } from "@/core/metadata/directive.ts";
import { Input } from "@/core/metadata/input.ts";
import type { ElementRef } from "@/core/refs/element-ref.ts";

/**
 * `[cdkTrapFocus]` (+ `cdkTrapFocusAutoCapture`) — misma directiva que `@angular/cdk/a11y`. Crea un `FocusTrap`
 * contra su host. Con `autoCapture`, al inicializar guarda el elemento con foco y enfoca el inicial; al destruirse
 * lo restaura.
 */
@Directive({ selector: "[cdkTrapFocus]", exportAs: "cdkTrapFocus" })
export class CdkTrapFocus implements AfterViewInit, OnDestroy {
  /** Atributo presente (vacío) o `"true"`: activo. */
  @Input({ binding: "@" }) cdkTrapFocusAutoCapture?: string;

  focusTrap?: FocusTrap;
  private previouslyFocused: HTMLElement | null = null;

  constructor(
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly factory: FocusTrapFactory,
  ) {}

  ngAfterViewInit(): void {
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

  ngOnDestroy(): void {
    this.focusTrap?.destroy();
    if (this.autoCapture && typeof this.previouslyFocused?.focus === "function") this.previouslyFocused.focus();
  }

  private get autoCapture(): boolean {
    const raw = this.cdkTrapFocusAutoCapture;
    return raw === "" || raw === "true" || raw === "cdkTrapFocusAutoCapture";
  }
}
