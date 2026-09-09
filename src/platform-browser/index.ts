/**
 * `ngjs-core/platform-browser` — superficie de clase de `@angular/platform-browser`:
 * `Title`, `Meta`, `DomSanitizer` + `SecurityContext` / tipos `Safe*`.
 *
 * `DOCUMENT`, `Location` / `LocationStrategy` / `PlatformLocation` / `APP_BASE_HREF`
 * y `ViewportScroller` son `@angular/common` — se exportan desde `ngjs-core/common`,
 * no acá (igual que en Angular real).
 */
export { Meta, type MetaDefinition, MetaImpl } from "@/platform-browser/meta.ts";
export * from "@/platform-browser/security/index.ts";
export { Title, TitleImpl } from "@/platform-browser/title.ts";
