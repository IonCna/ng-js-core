import type angular from "angular";
import { allowSanitizationBypassAndThrow, BypassType, unwrapSafeValue } from "@/platform-browser/security/bypass.ts";
import { sanitizeHtml } from "@/platform-browser/security/html-sanitizer.ts";

/**
 * `$sanitize` de AngularJS respaldado por el sanitizador de `DomSanitizer` (port del de `@angular/core`), sin
 * `ngSanitize`. `$sce` le delega todo HTML que no venga confiado (`$sce.trustAsHtml`), así `ng-bind-html` se porta
 * como `[innerHTML]` de Angular:
 *
 * - un string se sanea (mismo output que `DomSanitizer.sanitize(SecurityContext.HTML, …)`);
 * - un `SafeHtml` de `bypassSecurityTrustHtml(...)` se usa tal cual (el dev ya lo vetó);
 * - otro `Safe*` (p. ej. `SafeUrl`) en contexto HTML tira, como Angular.
 *
 * Va en `NativeModule` (no en `BrowserModule`): `$sceDelegate` resuelve `$sanitize` UNA vez, al crearse durante el
 * bootstrap — registrado desde un módulo lazy llegaría tarde. Si la app carga `ngSanitize`, el suyo gana (se
 * registra después).
 */
// biome-ignore lint/complexity/noStaticOnlyClass: convención del proyecto (clases, no closures sueltas); `factory` es la receta de DI
export class SanitizeBridge {
  static readonly factory: angular.Injectable<(...args: never[]) => (value: unknown) => string> = [
    "$document",
    ($document: angular.IDocumentService) => (value: unknown) =>
      SanitizeBridge.sanitize($document[0] as Document, value),
  ];

  static sanitize(doc: Document, value: unknown): string {
    if (value == null) return "";
    if (allowSanitizationBypassAndThrow(value, BypassType.Html)) return unwrapSafeValue(value) as string;
    return sanitizeHtml(doc, String(value));
  }
}
