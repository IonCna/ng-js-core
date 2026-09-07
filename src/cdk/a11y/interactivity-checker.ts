/**
 * `InteractivityChecker` — mismo servicio que `@angular/cdk/a11y`. Chequeos de
 * bajo nivel de si un elemento puede recibir foco o entrar en el orden de
 * tabulación. Lo consume `FocusTrap`.
 *
 * Versión simplificada respecto de CDK: sin los casos históricos de
 * `<frame>`/`<object>`/radios de IE. El chequeo de visibilidad es tolerante
 * (solo descarta `display:none` / `visibility:hidden` / `[hidden]`), no mide
 * geometría — así funciona en jsdom.
 */

export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "object",
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function getExplicitTabIndex(element: HTMLElement): number | null {
  const attr = element.getAttribute("tabindex");
  if (attr == null || attr === "") return null;
  const parsed = Number.parseInt(attr, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function isNativelyFocusable(element: HTMLElement): boolean {
  const tag = element.nodeName.toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea" || tag === "button") return true;
  if ((tag === "a" || tag === "area") && element.hasAttribute("href")) return true;
  if (tag === "iframe" || tag === "object") return true;
  return element.isContentEditable;
}

export class InteractivityChecker {
  static readonly $name = "InteractivityChecker";
  static readonly $inject = [] as const;

  isDisabled(element: HTMLElement): boolean {
    return element.hasAttribute("disabled") || (element as HTMLInputElement).disabled === true;
  }

  isVisible(element: HTMLElement): boolean {
    if (element.hidden) return false;
    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    if (!style) return true;
    return style.visibility !== "hidden" && style.display !== "none";
  }

  /** Puede recibir foco programáticamente (`.focus()`). */
  isFocusable(element: HTMLElement, config?: { ignoreVisibility?: boolean }): boolean {
    if (this.isDisabled(element)) return false;
    if (!config?.ignoreVisibility && !this.isVisible(element)) return false;
    return isNativelyFocusable(element) || getExplicitTabIndex(element) != null;
  }

  /** Además está en el orden de tabulación (`tabIndex >= 0`). */
  isTabbable(element: HTMLElement): boolean {
    if (!this.isFocusable(element)) return false;
    const explicit = getExplicitTabIndex(element);
    if (explicit != null) return explicit >= 0;
    return isNativelyFocusable(element);
  }
}
