/** Helpers compatibles con `@angular/common` para el único target browser. */
export function isPlatformBrowser(platformId: string): boolean {
  return platformId === "browser";
}

export function isPlatformServer(platformId: string): boolean {
  return platformId === "server";
}
