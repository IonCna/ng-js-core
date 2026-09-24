import { Inject } from "@/core/di/inject.ts";
import { Injectable } from "@/core/di/injectable.ts";
import { DOCUMENT } from "@/core/dom-tokens.ts";

/**
 * `Title` — mismo servicio que `@angular/platform-browser`. Lee y escribe
 * `document.title` y nada más. Qué título corresponde a cada ruta lo decide el
 * router (`TitleStrategy`), no acá.
 */
@Injectable()
export abstract class Title {
  abstract getTitle(): string;
  abstract setTitle(value: string): void;
}

@Injectable()
export class TitleImpl extends Title {
  constructor(@Inject(DOCUMENT) private readonly doc: Document) {
    super();
  }

  getTitle(): string {
    return this.doc.title;
  }

  setTitle(value: string): void {
    this.doc.title = value ?? "";
  }
}
