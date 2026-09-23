/**
 * Saneo de URLs — port de `@angular/core` (`sanitization/url_sanitizer.ts`).
 * Bloquea `javascript:` (y esquemas raros) neutralizándolos con el prefijo
 * `unsafe:`.
 */

// Permite: cualquier esquema `nombre:` que no sea `javascript:`, o paths
// relativos / scheme-relative. Igual que Angular.
const SAFE_URL_PATTERN = /^(?!javascript:)(?:[a-z0-9+.\-]+:|[^&:/?#]*(?:[/?#]|$))/i;

export function sanitizeUrl(url: string): string {
  const u = String(url);
  if (u.match(SAFE_URL_PATTERN)) return u;
  return `unsafe:${u}`;
}

const SAFE_SRCSET_PATTERN = /^(?:(?:https?|file):|[^&:/?#]*(?:[/?#]|$))/i;

export function sanitizeSrcset(srcset: string): string {
  return String(srcset)
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      const spaceIdx = trimmed.indexOf(" ");
      const rawUrl = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
      const descriptor = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx);
      const safeUrl = rawUrl.match(SAFE_SRCSET_PATTERN) ? rawUrl : `unsafe:${rawUrl}`;
      return safeUrl + descriptor;
    })
    .join(", ");
}
