/**
 * `ngjs-core/runtime` — el motor sin CLI. Lee la metadata estampada por los
 * decoradores (`ɵmod`/`ɵcmp`/…) y hace el registro de AngularJS en runtime, en
 * lugar del transform de build. Ver `docs/CAPAS.md`.
 *
 * Se usa `ngjs-core` + CLI **o** `ngjs-core/runtime`, nunca los dos.
 */

import type { ApplicationRef } from "@/core/platform/application-ref.ts";
import { type BootstrapOptions, platformBrowser } from "@/core/platform/bootstrap.ts";
import { installCoreModule } from "@/runtime/core-module.ts";
import { registerNgModule } from "@/runtime/ng-module-runtime.ts";

export type { BootstrapOptions } from "@/core/platform/bootstrap.ts";
export { CoreModule, configureCore, installCoreModule } from "@/runtime/core-module.ts";
export type { CreateComponentOptions } from "@/runtime/create-component.ts";
export { createComponent } from "@/runtime/create-component.ts";
export { getNgModuleName, registerNgModule } from "@/runtime/ng-module-runtime.ts";

/**
 * Bootstrap sin CLI. Registra el grafo del `@NgModule` (imports/declarations/
 * providers) leyendo su `ɵmod`, y arranca la app dentro de la zona. Equivalente
 * a `platformBrowserDynamic().bootstrapModule(AppModule)` de Angular.
 */
export function bootstrapModuleRuntime(appModule: Function, options?: BootstrapOptions): Promise<ApplicationRef> {
  installCoreModule();
  const name = registerNgModule(appModule).name;
  return platformBrowser().bootstrapModule(name, options);
}
