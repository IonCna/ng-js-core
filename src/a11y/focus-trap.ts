import { FOCUSABLE_SELECTOR, InteractivityChecker } from "@/a11y/interactivity-checker.ts";
import { ElementRef } from "@/core/refs/element-ref.ts";

/**
 * `FocusTrap` / `FocusTrapFactory` — misma superficie que `@angular/cdk/a11y`.
 * Atrapa el foco de teclado dentro de un contenedor (modales, dialogs): al
 * llegar al último elemento y apretar Tab, el foco vuelve al primero.
 *
 * Mecanismo de CDK: dos "anclas" invisibles `tabindex=0` antes y después del
 * host; enfocar la de arranque → salta al último tabbable, la de cierre → al
 * primero.
 */

const ANCHOR_CLASS = "cdk-focus-trap-anchor";

export class FocusTrap {
  private startAnchor: HTMLElement | null = null;
  private endAnchor: HTMLElement | null = null;
  private attached = false;
  private destroyed = false;

  private readonly onStartFocus = () => this.focusLastTabbableElement();
  private readonly onEndFocus = () => this.focusFirstTabbableElement();

  constructor(
    readonly host: HTMLElement,
    private readonly checker: InteractivityChecker,
    deferAnchors = false,
  ) {
    if (!deferAnchors) this.attachAnchors();
  }

  /** Inserta las anclas. Devuelve `false` si el host todavía no está en el DOM. */
  attachAnchors(): boolean {
    if (this.attached) return true;
    if (!this.host.parentNode) return false;

    this.startAnchor ??= this.createAnchor();
    this.endAnchor ??= this.createAnchor();
    this.startAnchor.addEventListener("focus", this.onStartFocus);
    this.endAnchor.addEventListener("focus", this.onEndFocus);
    this.host.parentNode.insertBefore(this.startAnchor, this.host);
    this.host.parentNode.insertBefore(this.endAnchor, this.host.nextSibling);
    this.attached = true;
    return true;
  }

  hasAttached(): boolean {
    return this.attached && !this.destroyed;
  }

  /** `[cdkFocusInitial]` si existe, si no el primer tabbable. */
  focusInitialElement(): boolean {
    const initial = this.host.querySelector<HTMLElement>("[cdkFocusInitial], [cdk-focus-initial]");
    if (initial) {
      initial.focus();
      return true;
    }
    return this.focusFirstTabbableElement();
  }

  focusFirstTabbableElement(): boolean {
    const target = this.regionBoundary("start");
    target?.focus();
    return !!target;
  }

  focusLastTabbableElement(): boolean {
    const target = this.regionBoundary("end");
    target?.focus();
    return !!target;
  }

  destroy(): void {
    this.startAnchor?.removeEventListener("focus", this.onStartFocus);
    this.endAnchor?.removeEventListener("focus", this.onEndFocus);
    this.startAnchor?.remove();
    this.endAnchor?.remove();
    this.startAnchor = null;
    this.endAnchor = null;
    this.attached = false;
    this.destroyed = true;
  }

  private regionBoundary(bound: "start" | "end"): HTMLElement | null {
    const marker = `[cdk-focus-region-${bound}], [cdkFocusRegion${bound === "start" ? "Start" : "End"}]`;
    const markers = this.host.querySelectorAll<HTMLElement>(marker);
    if (markers.length) return markers[markers.length - 1];

    const tabbables = Array.from(this.host.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) =>
      this.checker.isTabbable(el),
    );
    if (!tabbables.length) return null;
    return bound === "start" ? tabbables[0] : tabbables[tabbables.length - 1];
  }

  private createAnchor(): HTMLElement {
    const anchor = document.createElement("div");
    anchor.tabIndex = 0;
    anchor.classList.add(ANCHOR_CLASS);
    anchor.setAttribute("aria-hidden", "true");
    anchor.style.position = "fixed";
    return anchor;
  }
}

export class FocusTrapFactory {
  static readonly $name = "FocusTrapFactory";
  static readonly $inject = [InteractivityChecker.$name] as const;

  constructor(private readonly checker: InteractivityChecker) {}

  /** Acepta un `HTMLElement` o un `ElementRef` (desenvuelve `.nativeElement`), como en CDK. */
  create(element: HTMLElement | ElementRef<HTMLElement>, deferCaptureElements = false): FocusTrap {
    const host = element instanceof ElementRef ? element.nativeElement : element;
    return new FocusTrap(host, this.checker, deferCaptureElements);
  }
}
