import { DOCUMENT } from "@/platform-browser/dom-tokens.ts";

/**
 * `Title` — mismo servicio que `@angular/platform-browser`. Lee y escribe
 * `document.title` y nada más. Qué título corresponde a cada ruta lo decide el
 * router (`TitleStrategy`), no acá.
 */
export abstract class Title {
  static readonly $name = "Title";
  abstract getTitle(): string;
  abstract setTitle(value: string): void;
}

export class TitleImpl extends Title {
  static readonly $inject = [DOCUMENT.toString()];

  constructor(private readonly doc: Document) {
    super();
  }

  getTitle(): string {
    return this.doc.title;
  }

  setTitle(value: string): void {
    this.doc.title = value ?? "";
  }
}
