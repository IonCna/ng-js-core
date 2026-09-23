import { DOCUMENT } from "@/core/dom-tokens.ts";
import { Injectable } from "@/core/di/injectable.ts";
import { Renderer2, RendererFactory2, RendererStyleFlags2, type RendererType2 } from "@/core/render/renderer.ts";

/**
 * Etapa 20 — port de `@angular/platform-browser` (`dom_renderer.ts`): wrapper
 * fino sobre `Node`/`document`, sin `ViewEncapsulation.Emulated` (`RendererType2`
 * se acepta y se ignora — ver brecha documentada en docs/ORDEN-DE-CONSTRUCCION.md
 * § Etapa 20). `listen` usa `addEventListener` nativo tal cual: zone.js ya lo
 * parchea, así que el `$digest` sale solo (mismo mecanismo que
 * `host-listener-bridge.ts`, sin envolver en `NgZone.run` a mano).
 */
export class DefaultDomRenderer2 extends Renderer2 {
  data: { [key: string]: unknown } = {};
  destroyNode = null;

  constructor(private readonly doc: Document) {
    super();
  }

  destroy(): void {
    // no-op: sin ciclo de vida propio, no hay nada que liberar.
  }

  createElement(name: string, namespace?: string | null): Element {
    return namespace ? this.doc.createElementNS(namespace, name) : this.doc.createElement(name);
  }

  createComment(value: string): Comment {
    return this.doc.createComment(value);
  }

  createText(value: string): Text {
    return this.doc.createTextNode(value);
  }

  appendChild(parent: Node, newChild: Node): void {
    parent.appendChild(newChild);
  }

  insertBefore(parent: Node, newChild: Node, refChild: Node): void {
    if (parent) parent.insertBefore(newChild, refChild);
  }

  removeChild(parent: Node, oldChild: Node): void {
    parent?.removeChild(oldChild);
  }

  selectRootElement(selectorOrNode: string | Element, preserveContent?: boolean): Element {
    const el = typeof selectorOrNode === "string" ? this.doc.querySelector(selectorOrNode) : selectorOrNode;
    if (!el) throw new Error(`El elemento raíz no existe (selectRootElement): ${selectorOrNode}`);
    if (!preserveContent) el.textContent = "";
    return el;
  }

  parentNode(node: Node): Node | null {
    return node.parentNode;
  }

  nextSibling(node: Node): Node | null {
    return node.nextSibling;
  }

  setAttribute(el: Element, name: string, value: string, namespace?: string | null): void {
    if (namespace) el.setAttributeNS(namespace, `${namespace}:${name}`, value);
    else el.setAttribute(name, value);
  }

  removeAttribute(el: Element, name: string, namespace?: string | null): void {
    if (namespace) el.removeAttributeNS(namespace, name);
    else el.removeAttribute(name);
  }

  addClass(el: Element, name: string): void {
    el.classList.add(name);
  }

  removeClass(el: Element, name: string): void {
    el.classList.remove(name);
  }

  setStyle(el: HTMLElement, style: string, value: unknown, flags?: RendererStyleFlags2): void {
    if (flags && flags & RendererStyleFlags2.DashCase) {
      el.style.setProperty(style, String(value), flags & RendererStyleFlags2.Important ? "important" : "");
    } else {
      // biome-ignore lint/suspicious/noExplicitAny: `CSSStyleDeclaration` no tipa acceso dinámico por nombre camelCase.
      (el.style as any)[style] = value;
    }
  }

  removeStyle(el: HTMLElement, style: string, flags?: RendererStyleFlags2): void {
    if (flags && flags & RendererStyleFlags2.DashCase) el.style.removeProperty(style);
    // biome-ignore lint/suspicious/noExplicitAny: idem `setStyle`.
    else (el.style as any)[style] = "";
  }

  setProperty(el: unknown, name: string, value: unknown): void {
    // biome-ignore lint/suspicious/noExplicitAny: propiedad arbitraria del DOM (mismo enfoque que Angular real).
    (el as any)[name] = value;
  }

  setValue(node: Node, value: string): void {
    node.nodeValue = value;
  }

  listen(target: EventTarget, eventName: string, callback: (event: unknown) => boolean | undefined): () => void {
    target.addEventListener(eventName, callback as EventListener);
    return () => target.removeEventListener(eventName, callback as EventListener);
  }
}

/** Siempre devuelve la misma instancia — no hay pipeline de render propio donde diferenciar por host/type. */
@Injectable()
export class RendererFactory2Impl extends RendererFactory2 {
  static readonly $inject = [DOCUMENT.toString()];

  private readonly renderer: DefaultDomRenderer2;

  constructor(doc: Document) {
    super();
    this.renderer = new DefaultDomRenderer2(doc);
  }

  createRenderer(_hostElement: unknown, _type: RendererType2 | null): Renderer2 {
    return this.renderer;
  }
}
