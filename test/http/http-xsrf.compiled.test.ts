import { afterEach, describe, expect, it } from "vitest";
import { CompiledApp } from "../compiled-app.ts";

/**
 * Como Angular 16: `HttpClientModule` manda la cookie `XSRF-TOKEN` en el header `X-XSRF-TOKEN` de los requests que
 * modifican a una URL relativa; `HttpClientXsrfModule` la configura o la apaga; `new HttpClient(backend)` saltea los
 * interceptors (XSRF incluido).
 */
describe("XSRF y HttpHandler por DI (código compilado)", () => {
  let app: CompiledApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  async function boot(xsrfImport: string): Promise<{ run(): Promise<string[]> }> {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `
import { of } from "rxjs";
import { Component, Injectable, NgModule } from "ngjs-core";
import { HttpBackend, HttpClient, HttpClientModule, HttpClientXsrfModule, HttpHandler, type HttpRequest, HttpResponse } from "ngjs-core/common/http";

const seen: string[] = [];
@Injectable()
export class RecordingBackend extends HttpBackend {
  handle(req: HttpRequest<unknown>) {
    seen.push(req.method + " " + req.url + " → " + (req.headers.keys().filter((name) => /xsrf|csrf/i.test(name)).map((name) => name + "=" + req.headers.get(name)).join(";") || "sin token"));
    return of(new HttpResponse({ body: null }));
  }
}

@Component({ selector: "app-root", template: "" })
export class AppComponent {
  constructor(readonly http: HttpClient, readonly handler: HttpHandler, readonly backend: HttpBackend) {}
}

@NgModule({
  imports: [HttpClientModule${xsrfImport}],
  declarations: [AppComponent],
  bootstrap: [AppComponent],
  providers: [{ provide: HttpBackend, useClass: RecordingBackend }],
})
export class AppModule {}

(globalThis as any).run = async (root: AppComponent) => {
  document.cookie = "XSRF-TOKEN=abc";
  document.cookie = "MY-CSRF=xyz";
  const done = (o: { subscribe(fn: object): void }) => new Promise((resolve) => o.subscribe({ complete: resolve }));
  await done(root.http.post("/api/save", {}));
  await done(root.http.get("/api/list"));
  await done(root.http.post("https://otro.origen/api", {}));
  await done(new HttpClient(root.backend).post("/api/raw", {}));
  return seen;
};
`,
      },
      "<app-root></app-root>",
    );
    const root = app.controller("app-root", "appRoot");
    return { run: () => app!.global<(root: unknown) => Promise<string[]>>("run")(root) };
  }

  it("por defecto: header en el POST relativo; no en GET, ni a otro origen, ni salteando la cadena", async () => {
    const { run } = await boot("");
    expect(await run()).toEqual([
      "POST /api/save → X-XSRF-TOKEN=abc",
      "GET /api/list → sin token",
      "POST https://otro.origen/api → sin token",
      "POST /api/raw → sin token",
    ]);
  });

  it("HttpClientXsrfModule.withOptions() cambia cookie y header; disable() lo apaga", async () => {
    const custom = await boot(', HttpClientXsrfModule.withOptions({ cookieName: "MY-CSRF", headerName: "X-MY-CSRF" })');
    expect((await custom.run())[0]).toBe("POST /api/save → X-MY-CSRF=xyz");
    await app!.destroy();

    const off = await boot(", HttpClientXsrfModule.disable()");
    expect((await off.run())[0]).toBe("POST /api/save → sin token");
  });
});
