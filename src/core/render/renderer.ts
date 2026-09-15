/**
 * Etapa 20 — `Renderer2` / `RendererFactory2` (abstracción, `@angular/core`).
 *
 * Desbloquea portar código Angular que **inyecta `Renderer2`** en vez de tocar
 * el DOM directo. Puramente aditivo: nada del framework hoy pasa por acá (ver
 * docs/ORDEN-DE-CONSTRUCCION.md § Etapa 20, "Impacto en lo que ya está").
 */
export enum RendererStyleFlags2 {
  Important = 1,
  DashCase = 2,
}

/** Metadata de encapsulación — se acepta por firma pero se ignora (ver brecha). */
export interface RendererType2 {
  id: string;
  encapsulation: number;
  styles: string[];
  data?: { [kind: string]: unknown };
}

export abstract class Renderer2 {
  static readonly $name = "Renderer2";

  /** Bolsa libre para que el implementador cuelgue lo que necesite. */
  abstract data: { [key: string]: unknown };

  abstract destroy(): void;
  abstract createElement(name: string, namespace?: string | null): unknown;
  abstract createComment(value: string): unknown;
  abstract createText(value: string): unknown;
  abstract destroyNode: ((node: unknown) => void) | null;
  abstract appendChild(parent: unknown, newChild: unknown): void;
  abstract insertBefore(parent: unknown, newChild: unknown, refChild: unknown, isMove?: boolean): void;
  abstract removeChild(parent: unknown, oldChild: unknown, isHostElement?: boolean): void;
  abstract selectRootElement(selectorOrNode: string | unknown, preserveContent?: boolean): unknown;
  abstract parentNode(node: unknown): unknown;
  abstract nextSibling(node: unknown): unknown;
  abstract setAttribute(el: unknown, name: string, value: string, namespace?: string | null): void;
  abstract removeAttribute(el: unknown, name: string, namespace?: string | null): void;
  abstract addClass(el: unknown, name: string): void;
  abstract removeClass(el: unknown, name: string): void;
  abstract setStyle(el: unknown, style: string, value: unknown, flags?: RendererStyleFlags2): void;
  abstract removeStyle(el: unknown, style: string, flags?: RendererStyleFlags2): void;
  abstract setProperty(el: unknown, name: string, value: unknown): void;
  abstract setValue(node: unknown, value: string): void;
  abstract listen(target: unknown, eventName: string, callback: (event: unknown) => boolean | undefined): () => void;
}

export abstract class RendererFactory2 {
  static readonly $name = "RendererFactory2";

  abstract createRenderer(hostElement: unknown, type: RendererType2 | null): Renderer2;
  /** No-op acá: sin pipeline de render propio donde enganchar begin/end. */
  begin?(): void;
  end?(): void;
}
