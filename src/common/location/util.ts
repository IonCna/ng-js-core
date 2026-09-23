/**
 * Helpers de path calcados de `@angular/common` (`location/util.ts`). Los usan
 * `LocationStrategy` y `Location`.
 */

/** Antepone `?` si falta (y no está vacío). */
export function normalizeQueryParams(params: string): string {
  return params && params[0] !== "?" ? `?${params}` : params;
}

/** Une dos segmentos con exactamente una `/` en la junta. */
export function joinWithSlash(start: string, end: string): string {
  if (start.length === 0) return end;
  if (end.length === 0) return start;
  let slashes = 0;
  if (start.endsWith("/")) slashes++;
  if (end.startsWith("/")) slashes++;
  if (slashes === 2) return start + end.substring(1);
  if (slashes === 1) return start + end;
  return `${start}/${end}`;
}

/** Saca la `/` final del path (respeta `?query` y `#hash`). */
export function stripTrailingSlash(url: string): string {
  const match = url.match(/#|\?|$/);
  const pathEndIdx = (match && match.index) || url.length;
  const droppedSlashIdx = pathEndIdx - (url[pathEndIdx - 1] === "/" ? 1 : 0);
  return url.slice(0, droppedSlashIdx) + url.slice(pathEndIdx);
}
