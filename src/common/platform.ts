/**
 * Mismos helpers que `@angular/common`. `ngjs-core` corre siempre en el
 * navegador, así que `isPlatformBrowser` es siempre `true` y `isPlatformServer`
 * siempre `false` — se exponen para que el código portado de `ng-bootstrap`
 * (`isPlatformBrowser(inject(PLATFORM_ID))`) compile y tome la rama browser.
 */
export function isPlatformBrowser(platformId: string): boolean {
  return platformId === "browser";
}

export function isPlatformServer(platformId: string): boolean {
  return platformId === "server";
}
