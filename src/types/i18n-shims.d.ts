/**
 * `angular-translate` y `angular-aria` no publican tipos. Solo se importan por
 * side-effect (registran su `angular.module` en el `angular` global). Ver
 * `docs/ORDEN-DE-CONSTRUCCION.md` etapa 18.
 *
 * Las interfaces de `$translate` / `$translateProvider` que usa el código están
 * declaradas localmente donde se usan (`src/i18n/*`, `src/runtime/i18n/*`).
 */
declare module "angular-translate";
declare module "angular-aria";
