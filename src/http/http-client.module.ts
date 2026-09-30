import type { ModuleWithProviders } from "@/core/metadata/definitions.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { HttpBackend, HttpXhrBackend } from "@/http/http-backend.ts";
import { HttpClient, HttpInterceptingHandler } from "@/http/http-client.ts";
import { HttpHandler } from "@/http/http-interceptor.ts";
import { XSRF_COOKIE_NAME, XSRF_ENABLED, XSRF_HEADER_NAME } from "@/http/http-xsrf.ts";

/** Como Angular 16: `HttpClient` con los `HTTP_INTERCEPTORS` de la app y la protección XSRF activa. */
@NgModule({
  providers: [
    HttpClient,
    { provide: HttpHandler, useClass: HttpInterceptingHandler },
    { provide: HttpBackend, useClass: HttpXhrBackend },
  ],
})
export class HttpClientModule {}

/** Configura la protección XSRF de `HttpClientModule` (cookie y header), o la apaga. */
@NgModule({})
export class HttpClientXsrfModule {
  static disable(): ModuleWithProviders<HttpClientXsrfModule> {
    return { ngModule: HttpClientXsrfModule, providers: [{ provide: XSRF_ENABLED, useValue: false }] };
  }

  static withOptions(options: { cookieName?: string; headerName?: string } = {}): ModuleWithProviders<HttpClientXsrfModule> {
    return {
      ngModule: HttpClientXsrfModule,
      providers: [
        ...(options.cookieName ? [{ provide: XSRF_COOKIE_NAME, useValue: options.cookieName }] : []),
        ...(options.headerName ? [{ provide: XSRF_HEADER_NAME, useValue: options.headerName }] : []),
      ],
    };
  }
}
