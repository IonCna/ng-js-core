/**
 * `ngjs-core/runtime/core` — la superficie de autoría de `ngjs-core/core` re-exportada
 * con identidad preservada (las mismas clases-token, los mismos decoradores), más
 * `bootstrapModuleRuntime`. Un consumidor sin CLI importa todo de `ngjs-core/runtime/*`
 * y nunca toca `ngjs-core/core` pelado.
 */
export * from "@/core/index.ts";
export type { BootstrapOptions, CreateComponentOptions } from "@/runtime/index.ts";
export {
  bootstrapModuleRuntime,
  CoreModule,
  createComponent,
  getNgModuleName,
  registerNgModule,
} from "@/runtime/index.ts";
