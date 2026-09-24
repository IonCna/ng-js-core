import angular from "angular";
import { describe, expect, it } from "vitest";
import { HttpBackendImpl } from "@/http/http-backend.ts";
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
