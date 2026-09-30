/** Contexto de seguridad — mismo enum (y valores) que `@angular/core`. Lo usa `DomSanitizer` (`platform-browser`). */
export enum SecurityContext {
  NONE = 0,
  HTML = 1,
  STYLE = 2,
  SCRIPT = 3,
  URL = 4,
  RESOURCE_URL = 5,
}
