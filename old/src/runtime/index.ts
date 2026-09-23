/**
 * `ngjs-core/runtime` — el motor sin CLI. Lee la metadata estampada por los
 * decoradores (`ɵmod`/`ɵcmp`/…) y hace el registro de AngularJS en runtime, en
 * lugar del transform de build. Ver `docs/CAPAS.md`.
 *
 * Se usa `ngjs-core` + CLI **o** `ngjs-core/runtime`, nunca los dos.
 */

import { getComponentDef } from "@/core/metadata/define-component.ts";
import { getNgModuleDef, type StampedNgModuleDef } from "@/core/metadata/ng-module.ts";
import { parseSelector } from "@/core/metadata/selector-name.ts";
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
 * Bootstrap del modo runtime (el modo por defecto de `ngjs-core`). Registra el
 * grafo del `@NgModule` (imports/declarations/providers) leyendo su `ɵmod`, monta
 * los componentes de `@NgModule({ bootstrap })` en el host, y arranca la app
 * dentro de la zona. Equivalente a
 * `platformBrowserDynamic().bootstrapModule(AppModule)` de Angular.
 *
 * `bootstrap` **solo** se honra en el módulo pasado acá — igual que Angular, el de
 * un `@NgModule` importado es inerte (`imports` no arrastra `bootstrap`).
 */
export function bootstrapApplication(appModule: Function, options?: BootstrapOptions): Promise<ApplicationRef> {
  try {
    installCoreModule();
    const def = getNgModuleDef(appModule);
    const rootComponentTags = (def?.bootstrap ?? []).map((component) => resolveBootstrapTag(component, def));
    const name = registerNgModule(appModule).name;
    return platformBrowser().bootstrapModule(name, { ...options, rootComponentTags });
  } catch (error) {
    // errores de config (bootstrap inválido, @NgModule sin ɵmod) → promesa rechazada, como Angular
    return Promise.reject(error);
  }
}

/** Clase de `@NgModule({ bootstrap })` → tag de elemento (kebab) para montar en el host. */
function resolveBootstrapTag(component: Function, moduleDef: StampedNgModuleDef | undefined): string {
  const def = getComponentDef(component);
  if (!def) {
    throw new Error(`@NgModule.bootstrap: "${component.name}" no es un @Component.`);
  }
  // Angular exige que un componente de `bootstrap` esté también en `declarations`
  // del mismo `@NgModule`. Sin eso el componente no estaría registrado.
  if (!moduleDef?.declarations.includes(component)) {
    throw new Error(
      `@NgModule.bootstrap: "${component.name}" también tiene que estar en 'declarations' del mismo @NgModule.`,
    );
  }
  const parsed = parseSelector(def.selector);
  if (parsed.restrict !== "E") {
    throw new Error(`@NgModule.bootstrap: "${component.name}" necesita un selector de elemento, no de atributo.`);
  }
  return parsed.registrationName.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}
