import { DOCUMENT } from "@/platform-browser/dom-tokens.ts";

/**
 * `ViewportScroller` — control imperativo del scroll del viewport. Mismo servicio
 * y API que `@angular/common`. Todo DOM sobre `$window` + `DOCUMENT`. Sin
 * integración con el router (eso es `withInMemoryScrolling`, aparte).
 */
export abstract class ViewportScroller {
  static readonly $name = "ViewportScroller";

  /** Offset fijo (o función que lo calcula) que se resta al hacer scroll a un ancla — p.ej. un header fixed. */
  abstract setOffset(offset: [number, number] | (() => [number, number])): void;
  abstract getScrollPosition(): [number, number];
  abstract scrollToPosition(position: [number, number]): void;
  /** Scroll al elemento con ese `id` o `name`. */
  abstract scrollToAnchor(anchor: string): void;
  /** `window.history.scrollRestoration` — `'manual'` = la app maneja el scroll en back/forward. */
  abstract setHistoryScrollRestoration(scrollRestoration: "auto" | "manual"): void;
}

function findAnchor(doc: Document, target: string): HTMLElement | null {
  const found = doc.getElementById(target) ?? (doc.getElementsByName(target)[0] as HTMLElement | undefined);
  if (found) return found as HTMLElement;

  // `getElementById`/`getElementsByName` no atraviesan shadow DOM — recorrer a mano.
  if (
    typeof doc.createTreeWalker === "function" &&
    doc.body &&
    typeof doc.body.attachShadow === "function"
  ) {
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode as HTMLElement | null;
    while (node) {
      const shadow = node.shadowRoot;
      if (shadow) {
        const hit = shadow.getElementById(target) ?? shadow.querySelector(`[name="${target}"]`);
        if (hit) return hit as HTMLElement;
      }
      node = walker.nextNode() as HTMLElement | null;
    }
  }
  return null;
}

export class BrowserViewportScroller extends ViewportScroller {
  static readonly $inject = ["$window", DOCUMENT.toString()];

  private offset: () => [number, number] = () => [0, 0];

  constructor(
    private readonly win: Window,
    private readonly doc: Document,
  ) {
    super();
  }

  setOffset(offset: [number, number] | (() => [number, number])): void {
    this.offset = Array.isArray(offset) ? () => offset : offset;
  }

  getScrollPosition(): [number, number] {
    return this.supportsScrolling() ? [this.win.scrollX, this.win.scrollY] : [0, 0];
  }

  scrollToPosition(position: [number, number]): void {
    if (this.supportsScrolling()) this.win.scrollTo(position[0], position[1]);
  }

  scrollToAnchor(anchor: string): void {
    if (!this.supportsScrolling()) return;
    const el = findAnchor(this.doc, anchor);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const [offsetX, offsetY] = this.offset();
    this.win.scrollTo(rect.left + this.win.scrollX - offsetX, rect.top + this.win.scrollY - offsetY);
    // La spec pide enfocar el elemento después (a11y).
    el.focus();
  }

  setHistoryScrollRestoration(scrollRestoration: "auto" | "manual"): void {
    if (!this.supportsScrolling()) return;
    const history = this.win.history;
    if (history?.scrollRestoration) history.scrollRestoration = scrollRestoration;
  }

  private supportsScrolling(): boolean {
    try {
      return !!this.win && typeof this.win.scrollTo === "function" && "scrollX" in this.win;
    } catch {
      return false;
    }
  }
}
