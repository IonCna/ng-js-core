import { DOCUMENT } from "@/core/dom-tokens.ts";

/**
 * Forma de una `<meta>` a crear/actualizar. Las claves son los atributos tal
 * cual (`name`, `property`, `content`, `charset`, `itemprop`, …); `httpEquiv` se
 * mapea a `http-equiv`.
 */
export type MetaDefinition = {
  charset?: string;
  content?: string;
  httpEquiv?: string;
  id?: string;
  itemprop?: string;
  name?: string;
  property?: string;
  scheme?: string;
  url?: string;
} & Record<string, string | undefined>;

const META_KEYS_MAP: Record<string, string> = { httpEquiv: "http-equiv" };

/**
 * `Meta` — administra los `<meta>` del `<head>` en runtime. Mismo servicio y API
 * que `@angular/platform-browser`. Todo DOM sobre `DOCUMENT`, sin sustrato de
 * AngularJS. No hay integración con el router (Angular tampoco tiene
 * "MetaStrategy"): el meta por ruta se setea a mano desde un componente / guard /
 * resolver.
 */
export abstract class Meta {
  static readonly $name = "Meta";
  abstract addTag(tag: MetaDefinition, forceCreation?: boolean): HTMLMetaElement | null;
  abstract addTags(tags: MetaDefinition[], forceCreation?: boolean): HTMLMetaElement[];
  abstract getTag(attrSelector: string): HTMLMetaElement | null;
  abstract getTags(attrSelector: string): HTMLMetaElement[];
  abstract updateTag(tag: MetaDefinition, selector?: string): HTMLMetaElement | null;
  abstract removeTag(attrSelector: string): void;
  abstract removeTagElement(meta: HTMLMetaElement): void;
}

export class MetaImpl extends Meta {
  static readonly $inject = [DOCUMENT.toString()];

  constructor(private readonly doc: Document) {
    super();
  }

  addTag(tag: MetaDefinition, forceCreation = false): HTMLMetaElement | null {
    if (!tag) return null;
    return this.getOrCreateElement(tag, forceCreation);
  }

  addTags(tags: MetaDefinition[], forceCreation = false): HTMLMetaElement[] {
    if (!tags) return [];
    return tags.reduce<HTMLMetaElement[]>((result, tag) => {
      if (tag) result.push(this.getOrCreateElement(tag, forceCreation));
      return result;
    }, []);
  }

  getTag(attrSelector: string): HTMLMetaElement | null {
    if (!attrSelector) return null;
    return this.doc.querySelector<HTMLMetaElement>(`meta[${attrSelector}]`) ?? null;
  }

  getTags(attrSelector: string): HTMLMetaElement[] {
    if (!attrSelector) return [];
    return Array.from(this.doc.querySelectorAll<HTMLMetaElement>(`meta[${attrSelector}]`));
  }

  updateTag(tag: MetaDefinition, selector?: string): HTMLMetaElement | null {
    if (!tag) return null;
    const sel = selector || this.parseSelector(tag);
    const meta = this.getTag(sel);
    if (meta) return this.setAttributes(tag, meta);
    return this.getOrCreateElement(tag, true);
  }

  removeTag(attrSelector: string): void {
    this.removeTagElement(this.getTag(attrSelector) as HTMLMetaElement);
  }

  removeTagElement(meta: HTMLMetaElement): void {
    meta?.remove();
  }

  private getOrCreateElement(meta: MetaDefinition, forceCreation = false): HTMLMetaElement {
    if (!forceCreation) {
      // Puede haber varias `<meta>` con el mismo `name`/`property`: el selector no alcanza,
      // hay que chequear que TODOS los atributos de la definición coincidan.
      const existing = this.getTags(this.parseSelector(meta)).find((el) => this.containsAttributes(meta, el));
      if (existing !== undefined) return existing;
    }
    const element = this.doc.createElement("meta") as HTMLMetaElement;
    this.setAttributes(meta, element);
    this.doc.getElementsByTagName("head")[0].appendChild(element);
    return element;
  }

  private setAttributes(tag: MetaDefinition, el: HTMLMetaElement): HTMLMetaElement {
    for (const prop of Object.keys(tag)) {
      const value = tag[prop];
      if (value !== undefined) el.setAttribute(this.keyMap(prop), value);
    }
    return el;
  }

  private parseSelector(tag: MetaDefinition): string {
    const attr = tag.name ? "name" : "property";
    return `${attr}="${tag[attr]}"`;
  }

  private containsAttributes(tag: MetaDefinition, el: HTMLMetaElement): boolean {
    return Object.keys(tag).every((key) => el.getAttribute(this.keyMap(key)) === tag[key]);
  }

  private keyMap(prop: string): string {
    return META_KEYS_MAP[prop] ?? prop;
  }
}
