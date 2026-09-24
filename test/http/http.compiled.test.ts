import { afterEach, describe, expect, it } from "vitest";
import { CompiledApp } from "../compiled-app.ts";

/**
 * `HttpClientModule` provee `HttpClient` por DI y junta los `HTTP_INTERCEPTORS` (`multi`) en orden; el `HttpBackend`
 * se reemplaza por DI como en Angular. El pedido real contra `$httpBackend` lo cubre `http-client.test.ts`.
 */
describe("etapa 13 — HttpClientModule (código compilado)", () => {
  let app: CompiledApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  it("HttpClient por DI, con los interceptors multi aplicados en orden y un HttpBackend propio", async () => {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `
import { of } from "rxjs";
import { Component, Injectable, NgModule } from "ngjs-core";
import { HTTP_INTERCEPTORS, HttpBackend, HttpClient, HttpClientModule, type HttpHandler, type HttpInterceptor, type HttpRequest, HttpResponse } from "ngjs-core/common/http";

export const seen: string[] = [];
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler) { seen.push("auth"); return next.handle(req.clone({ headers: req.headers.set("Authorization", "Bearer x") })); }
}
@Injectable()
export class LoggingInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler) { seen.push("logging"); return next.handle(req); }
}
@Injectable()
export class FakeBackend extends HttpBackend {
  handle(req: HttpRequest<unknown>) {
    seen.push("backend:" + req.method + " " + req.url + " " + req.headers.get("Authorization"));
    return of(new HttpResponse({ status: 200, body: { ok: true }, url: req.url }));
  }
}

@Component({ selector: "app-root", template: "" })
export class AppComponent { constructor(readonly http: HttpClient) {} }

@NgModule({
  imports: [HttpClientModule],
  declarations: [AppComponent],
  bootstrap: [AppComponent],
  providers: [
    { provide: HttpBackend, useClass: FakeBackend },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: LoggingInterceptor, multi: true },
  ],
})
export class AppModule {}
(globalThis as any).seen = seen;
`,
      },
      "<app-root></app-root>",
    );

    let body: unknown;
    app
      .controller<{ http: { get(url: string): { subscribe(fn: (v: unknown) => void): void } } }>("app-root", "appRoot")
      .http.get("/api/secure")
      .subscribe((value) => (body = value));

    expect(body).toEqual({ ok: true });
    expect(app.global<string[]>("seen")).toEqual(["auth", "logging", "backend:GET /api/secure Bearer x"]);
  });
});
