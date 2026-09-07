/**
 * Valores "seguros" del `DomSanitizer` — port de `@angular/core`
 * (`sanitization/bypass.ts`). Son wrappers opacos: marcan que un string ya fue
 * vetado por el dev para un contexto puntual. Las interfaces son marcador (sin
 * miembros); en runtime son instancias de `SafeValueImpl`.
 */

// biome-ignore lint/suspicious/noEmptyInterface: marcador branded, como en Angular
export interface SafeValue {}
// biome-ignore lint/suspicious/noEmptyInterface: idem
export interface SafeHtml extends SafeValue {}
// biome-ignore lint/suspicious/noEmptyInterface: idem
export interface SafeStyle extends SafeValue {}
// biome-ignore lint/suspicious/noEmptyInterface: idem
export interface SafeScript extends SafeValue {}
// biome-ignore lint/suspicious/noEmptyInterface: idem
export interface SafeUrl extends SafeValue {}
// biome-ignore lint/suspicious/noEmptyInterface: idem
export interface SafeResourceUrl extends SafeValue {}

export const enum BypassType {
  Url = "URL",
  Html = "HTML",
  ResourceUrl = "ResourceURL",
  Script = "Script",
  Style = "Style",
}

abstract class SafeValueImpl implements SafeValue {
  constructor(readonly changingThisBreaksApplicationSecurity: string) {}
  abstract getTypeName(): BypassType;
  toString(): string {
    return (
      `SafeValue must use [property]=binding: ${this.changingThisBreaksApplicationSecurity}` +
      ` (see https://g.co/ng/security#xss)`
    );
  }
}

class SafeHtmlImpl extends SafeValueImpl implements SafeHtml {
  getTypeName(): BypassType {
    return BypassType.Html;
  }
}
class SafeStyleImpl extends SafeValueImpl implements SafeStyle {
  getTypeName(): BypassType {
    return BypassType.Style;
  }
}
class SafeScriptImpl extends SafeValueImpl implements SafeScript {
  getTypeName(): BypassType {
    return BypassType.Script;
  }
}
class SafeUrlImpl extends SafeValueImpl implements SafeUrl {
  getTypeName(): BypassType {
    return BypassType.Url;
  }
}
class SafeResourceUrlImpl extends SafeValueImpl implements SafeResourceUrl {
  getTypeName(): BypassType {
    return BypassType.ResourceUrl;
  }
}

export function unwrapSafeValue(value: SafeValue): string;
export function unwrapSafeValue<T>(value: T): T;
export function unwrapSafeValue(value: unknown): unknown {
  return value instanceof SafeValueImpl ? value.changingThisBreaksApplicationSecurity : value;
}

export function getSanitizationBypassType(value: unknown): BypassType | null {
  return value instanceof SafeValueImpl ? value.getTypeName() : null;
}

/**
 * `true` si `value` ya viene bypasseado para `type`. Si viene bypasseado para
 * OTRO tipo, tira (salvo `ResourceUrl` pedido como `Url` — es un subconjunto).
 */
export function allowSanitizationBypassAndThrow(value: unknown, type: BypassType): boolean {
  const actualType = getSanitizationBypassType(value);
  if (actualType != null && actualType !== type) {
    if (actualType === BypassType.ResourceUrl && type === BypassType.Url) return true;
    throw new Error(`Required a safe ${type}, got a ${actualType} (see https://g.co/ng/security#xss)`);
  }
  return actualType === type;
}

export function bypassSanitizationTrustHtml(value: string): SafeHtml {
  return new SafeHtmlImpl(value);
}
export function bypassSanitizationTrustStyle(value: string): SafeStyle {
  return new SafeStyleImpl(value);
}
export function bypassSanitizationTrustScript(value: string): SafeScript {
  return new SafeScriptImpl(value);
}
export function bypassSanitizationTrustUrl(value: string): SafeUrl {
  return new SafeUrlImpl(value);
}
export function bypassSanitizationTrustResourceUrl(value: string): SafeResourceUrl {
  return new SafeResourceUrlImpl(value);
}
