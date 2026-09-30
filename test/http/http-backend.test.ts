import angular from "angular";
import { describe, expect, it } from "vitest";
import { HttpBackendImpl } from "@/http/http-backend.ts";
import { HttpHeaders } from "@/http/http-headers.ts";
import { HttpParams } from "@/http/http-params.ts";
import { HttpRequest } from "@/http/http-request.ts";
import type { HttpErrorResponse, HttpResponse } from "@/http/http-response.ts";

function mockHttpBackend(): { $httpBackend: angular.IHttpBackendService; backend: HttpBackendImpl } {
  const injector = angular.injector(["ng", "ngMock"]);
  const $httpBackend = injector.get<angular.IHttpBackendService>("$httpBackend");
  const backend = new HttpBackendImpl($httpBackend as unknown as angular.IHttpBackendService);
  return { $httpBackend, backend };
}

describe("etapa 13 — HttpBackend (contra $httpBackend mockeado real de ngMock)", () => {
  it("una respuesta 2xx emite un HttpResponse y completa", () => {
    const { $httpBackend, backend } = mockHttpBackend();
    $httpBackend.expectGET("/api/users").respond(200, { ok: true }, { "x-total": "1" });

    let response: HttpResponse<unknown> | undefined;
    let completed = false;
    backend.handle(new HttpRequest("GET", "/api/users")).subscribe({
      next: (event) => {
        response = event;
      },
      complete: () => {
        completed = true;
      },
    });

    $httpBackend.flush();

    expect(response?.status).toBe(200);
    expect(response?.ok).toBe(true);
    expect(response?.body).toEqual({ ok: true });
    expect(response?.headers.get("x-total")).toBe("1");
    expect(completed).toBe(true);
  });

  it("una respuesta de error (4xx/5xx) emite un HttpErrorResponse como error del Observable", () => {
    const { $httpBackend, backend } = mockHttpBackend();
    $httpBackend.expectGET("/api/missing").respond(404, "not found");

    let error: HttpErrorResponse | undefined;
    backend.handle(new HttpRequest("GET", "/api/missing")).subscribe({
      error: (err) => {
        error = err;
      },
    });

    $httpBackend.flush();

    expect(error?.status).toBe(404);
    expect(error?.ok).toBe(false);
    expect(error?.error).toBe("not found");
  });

  it("unsubscribe() antes del flush cancela la request de verdad (no queda pendiente)", async () => {
    const { $httpBackend, backend } = mockHttpBackend();
    $httpBackend.expectGET("/api/cancel").respond(200, {});

    const subscription = backend.handle(new HttpRequest("GET", "/api/cancel")).subscribe();
    subscription.unsubscribe();

    // resolver la promise de cancelación es async (microtask) — como el
    // abort() real de un XHR, no es sincrónico.
    await Promise.resolve();

    expect(() => $httpBackend.verifyNoOutstandingRequest()).not.toThrow();
  });

  it("POST manda el body", () => {
    const { $httpBackend, backend } = mockHttpBackend();
    $httpBackend.expectPOST("/api/users", { name: "max" }).respond(201, { id: 1 });

    let body: unknown;
    backend.handle(new HttpRequest("POST", "/api/users", { name: "max" })).subscribe((event) => {
      body = event.body;
    });

    $httpBackend.flush();

    expect(body).toEqual({ id: 1 });
  });
});

/** XHR falso: registra lo que el `$httpBackend` REAL de AngularJS le pasa (`send`, `setRequestHeader`) — ngMock no. */
class FakeXhr {
  sent: unknown = undefined;
  requestHeaders: Record<string, string> = {};
  responseType = "";
  withCredentials = false;
  upload = { addEventListener() {} };
  open() {}
  setRequestHeader(name: string, value: string) {
    this.requestHeaders[name] = value;
  }
  send(body: unknown) {
    this.sent = body;
  }
  addEventListener() {}
  abort() {}
  getAllResponseHeaders() {
    return "";
  }
}

function realHttpBackend(): { xhr: FakeXhr; backend: HttpBackendImpl } {
  const xhr = new FakeXhr();
  const injector = angular.injector([
    "ng",
    // Cuerpo con llaves: lo que devuelve un módulo-función, AngularJS lo toma como run block.
    ($provide: angular.auto.IProvideService) => {
      $provide.value("$xhrFactory", () => xhr);
    },
  ]);
  return { xhr, backend: new HttpBackendImpl(injector.get<angular.IHttpBackendService>("$httpBackend")) };
}

describe("HttpBackend — lo que llega al XHR (con el $httpBackend real, sin ngMock)", () => {
  it("un objeto viaja como JSON con Content-Type application/json", () => {
    const { xhr, backend } = realHttpBackend();
    backend.handle(new HttpRequest("POST", "/api", { name: "Max" })).subscribe();

    expect(xhr.sent).toBe('{"name":"Max"}');
    expect(xhr.requestHeaders["Content-Type"]).toBe("application/json");
  });

  it("arrays, números y booleanos también van como JSON", () => {
    for (const [body, sent] of [[[1, 2], "[1,2]"], [0, "0"], [false, "false"]] as const) {
      const { xhr, backend } = realHttpBackend();
      backend.handle(new HttpRequest("PUT", "/api", body)).subscribe();
      expect(xhr.sent).toBe(sent);
      expect(xhr.requestHeaders["Content-Type"]).toBe("application/json");
    }
  });

  it("un string va tal cual como text/plain; HttpParams como form-urlencoded", () => {
    const text = realHttpBackend();
    text.backend.handle(new HttpRequest("POST", "/api", "hola")).subscribe();
    expect(text.xhr.sent).toBe("hola");
    expect(text.xhr.requestHeaders["Content-Type"]).toBe("text/plain");

    const form = realHttpBackend();
    const params = new HttpParams().set("a", "1").set("b", "2");
    form.backend.handle(new HttpRequest("POST", "/api", params)).subscribe();
    expect(form.xhr.sent).toBe("a=1&b=2");
    expect(form.xhr.requestHeaders["Content-Type"]).toBe("application/x-www-form-urlencoded;charset=UTF-8");
  });

  it("FormData/URLSearchParams pasan sin tocar y sin Content-Type (lo pone el navegador)", () => {
    for (const body of [new FormData(), new URLSearchParams("a=1")]) {
      const { xhr, backend } = realHttpBackend();
      backend.handle(new HttpRequest("POST", "/api", body)).subscribe();
      expect(xhr.sent).toBe(body);
      expect(Object.keys(xhr.requestHeaders).some((name) => name.toLowerCase() === "content-type")).toBe(false);
    }
  });

  it("el Content-Type del dev gana sobre el detectado", () => {
    const { xhr, backend } = realHttpBackend();
    const headers = new HttpHeaders().set("Content-Type", "application/vnd.api+json");
    backend.handle(new HttpRequest("POST", "/api", { a: 1 }, { headers })).subscribe();

    expect(xhr.sent).toBe('{"a":1}');
    expect(xhr.requestHeaders["content-type"]).toBe("application/vnd.api+json");
    expect(xhr.requestHeaders["Content-Type"]).toBeUndefined();
  });

  it("sin body: send(null) y sin Content-Type", () => {
    const { xhr, backend } = realHttpBackend();
    backend.handle(new HttpRequest("GET", "/api")).subscribe();

    expect(xhr.sent).toBeNull();
    expect(xhr.requestHeaders["Content-Type"]).toBeUndefined();
  });
});
