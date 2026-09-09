// `ngjs-core` (raíz) = superficie de `@angular/core` + el motor del modo runtime.
//
// Las features viven en subpaths, igual que los paquetes `@angular/*` de Angular
// real — NO se re-exportan desde acá:
//   ngjs-core/common          ngjs-core/common/http     ngjs-core/forms
//   ngjs-core/router          ngjs-core/animations      ngjs-core/i18n
//   ngjs-core/platform-browser ngjs-core/cdk/a11y       ngjs-core/cdk/layout
//   ngjs-core/rxjs-interop    (= @angular/core/rxjs-interop)

// --- @angular/core --------------------------------------------------------
export * from "./core/index.ts";
export { EventEmitter } from "./event-emitter.ts";
export type { PipeTransform } from "./pipes/pipe-transform.ts";

// --- Motor del modo runtime (el modo por defecto de `ngjs-core`) ----------
// Camina el `ɵmod` de las clases `@NgModule` y hace el registro de AngularJS al
// arrancar, sin build step. `bootstrapApplication(AppModule)` es el entrypoint
// (equivalente a `platformBrowserDynamic().bootstrapModule(AppModule)`).
export type { CreateComponentOptions } from "./runtime/index.ts";
export {
  bootstrapApplication,
  CoreModule,
  configureCore,
  createComponent,
  getNgModuleName,
  installCoreModule,
  registerNgModule,
} from "./runtime/index.ts";
