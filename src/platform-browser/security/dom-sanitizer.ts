import { DOCUMENT } from "@/platform-browser/dom-tokens.ts";
import {
  allowSanitizationBypassAndThrow,
  BypassType,
  bypassSanitizationTrustHtml,
  bypassSanitizationTrustResourceUrl,
  bypassSanitizationTrustScript,
  bypassSanitizationTrustStyle,
  bypassSanitizationTrustUrl,
  type SafeHtml,
  type SafeResourceUrl,
  type SafeScript,
  type SafeStyle,
  type SafeUrl,
  type SafeValue,
  unwrapSafeValue,
} from "@/platform-browser/security/bypass.ts";
import { sanitizeHtml } from "@/platform-browser/security/html-sanitizer.ts";
import { sanitizeUrl } from "@/platform-browser/security/url-sanitizer.ts";

/** Contexto de seguridad — mismo enum (y valores) que `@angular/core`. */
export enum SecurityContext {
  NONE = 0,
  HTML = 1,
  STYLE = 2,
  SCRIPT = 3,
  URL = 4,
  RESOURCE_URL = 5,
}

/**
 * `DomSanitizer` — mismo servicio y API que `@angular/platform-browser`.
 *
 * `sanitize(HTML, …)` usa un port del sanitizador de `@angular/core` (output
 * idéntico, sin `ngSanitize`). `sanitize(URL, …)` bloquea `javascript:`.
 * `sanitize(STYLE, …)` devuelve el valor tal cual (Angular sacó el saneo de CSS
 * en la v10). `sanitize(SCRIPT | RESOURCE_URL, string)` **tira** — solo aceptan
 * valores bypasseados, igual que Angular.
 */
export abstract class DomSanitizer {
  static readonly $name = "DomSanitizer";

  abstract sanitize(context: SecurityContext, value: SafeValue | string | null): string | null;
  abstract bypassSecurityTrustHtml(value: string): SafeHtml;
  abstract bypassSecurityTrustStyle(value: string): SafeStyle;
  abstract bypassSecurityTrustScript(value: string): SafeScript;
  abstract bypassSecurityTrustUrl(value: string): SafeUrl;
  abstract bypassSecurityTrustResourceUrl(value: string): SafeResourceUrl;
}

export class DomSanitizerImpl extends DomSanitizer {
  static readonly $inject = [DOCUMENT.toString()];

  constructor(private readonly doc: Document) {
    super();
  }

  sanitize(context: SecurityContext, value: SafeValue | string | null): string | null {
    if (value == null) return null;

    switch (context) {
      case SecurityContext.NONE:
        return value as string;
      case SecurityContext.HTML:
        if (allowSanitizationBypassAndThrow(value, BypassType.Html)) return unwrapSafeValue(value);
        return sanitizeHtml(this.doc, String(value));
      case SecurityContext.STYLE:
        if (allowSanitizationBypassAndThrow(value, BypassType.Style)) return unwrapSafeValue(value);
        return value as string;
      case SecurityContext.SCRIPT:
        if (allowSanitizationBypassAndThrow(value, BypassType.Script)) return unwrapSafeValue(value);
        throw new Error("unsafe value used in a script context");
      case SecurityContext.URL:
        if (allowSanitizationBypassAndThrow(value, BypassType.Url)) return unwrapSafeValue(value);
        return sanitizeUrl(String(value));
      case SecurityContext.RESOURCE_URL:
        if (allowSanitizationBypassAndThrow(value, BypassType.ResourceUrl)) return unwrapSafeValue(value);
        throw new Error(
          "unsafe value used in a resource URL context (see https://g.co/ng/security#xss)",
        );
      default:
        throw new Error(`Unexpected SecurityContext ${context} (see https://g.co/ng/security#xss)`);
    }
  }

  bypassSecurityTrustHtml(value: string): SafeHtml {
    return bypassSanitizationTrustHtml(value);
  }
  bypassSecurityTrustStyle(value: string): SafeStyle {
    return bypassSanitizationTrustStyle(value);
  }
  bypassSecurityTrustScript(value: string): SafeScript {
    return bypassSanitizationTrustScript(value);
  }
  bypassSecurityTrustUrl(value: string): SafeUrl {
    return bypassSanitizationTrustUrl(value);
  }
  bypassSecurityTrustResourceUrl(value: string): SafeResourceUrl {
    return bypassSanitizationTrustResourceUrl(value);
  }
}
