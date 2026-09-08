export * from "./cdk/a11y/index.ts";
export * from "./cdk/layout/index.ts";
export * from "./animations/index.ts";
export * from "./common/index.ts";
export * from "./core/index.ts";
export * from "./core/platform/index.ts";

// Motor del modo runtime — el modo por defecto de `ngjs-core`. Camina el `ɵmod`
// de las clases `@NgModule` y hace el registro de AngularJS al arrancar, sin
// build step. `bootstrapApplication(AppModule)` es el entrypoint (equivalente a
// `platformBrowserDynamic().bootstrapModule(AppModule)` de Angular).
export {
  bootstrapApplication,
  configureCore,
  CoreModule,
  createComponent,
  getNgModuleName,
  installCoreModule,
  registerNgModule,
} from "./runtime/index.ts";
export type { CreateComponentOptions } from "./runtime/index.ts";

export { EventEmitter } from "./event-emitter.ts";
export { HttpBackend } from "./http/http-backend.ts";
export type { HttpOptions } from "./http/http-client.ts";
export { HttpClient } from "./http/http-client.ts";
export { HttpHeaders } from "./http/http-headers.ts";
export type { HttpHandler, HttpInterceptor } from "./http/http-interceptor.ts";
export { HTTP_INTERCEPTORS } from "./http/http-interceptor.ts";
export { HttpParams } from "./http/http-params.ts";
export type { HttpMethod, HttpObserve, HttpRequestInit, HttpResponseType } from "./http/http-request.ts";
export { HttpRequest } from "./http/http-request.ts";
export type { HttpErrorResponseInit, HttpEvent, HttpResponseInit } from "./http/http-response.ts";
export { HttpErrorResponse, HttpEventType, HttpResponse } from "./http/http-response.ts";
export * from "./i18n/index.ts";
export type { PipeTransform } from "./pipes/pipe-transform.ts";
export * from "./platform-browser/index.ts";
export * from "./router/index.ts";
export * from "./rxjs-interop/index.ts";
