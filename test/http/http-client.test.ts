import angular from "angular";
import { describe, expect, it } from "vitest";
import { Injector, InjectorImpl } from "@/core/di/injector.ts";
import { HttpBackend, HttpBackendImpl } from "@/http/http-backend.ts";
import { HttpClient, HttpClientImpl } from "@/http/http-client.ts";
import { HTTP_INTERCEPTORS, type HttpHandler, type HttpInterceptor } from "@/http/http-interceptor.ts";
import { HttpErrorResponse, HttpResponse } from "@/http/http-response.ts";
import type { HttpRequest } from "@/http/http-request.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

function bootHttpClient(interceptors: HttpInterceptor[] = []): {
  $httpBackend: angular.IHttpBackendService;
  httpClient: HttpClient;
} {
  const name = uniqueName("httpClientTest");
  angular
    .module(name, ["ngMock"])
    .service(Injector.$name, InjectorImpl)
    .service(HttpBackend.$name, HttpBackendImpl)
    .service(HttpClient.$name, HttpClientImpl)
    .constant(HTTP_INTERCEPTORS.toString(), interceptors);

  const injector = angular.bootstrap(document.createElement("div"), [name], { strictDi: false });
  return {
    $httpBackend: injector.get<angular.IHttpBackendService>("$httpBackend"),
    httpClient: injector.get<HttpClient>(HttpClient.$name),
  };
}

describe("etapa 13 — HttpClient (end-to-end, sin $http)", () => {
  it("get<T>() devuelve solo el body por default", () => {
    const { $httpBackend, httpClient } = bootHttpClient();
    $httpBackend.expectGET("/api/users/1").respond(200, { id: 1, name: "max" });

    let result: unknown;
    httpClient.get<{ id: number; name: string }>("/api/users/1").subscribe((value) => {
      result = value;
    });
    $httpBackend.flush();

    expect(result).toEqual({ id: 1, name: "max" });
  });

  it("observe: 'response' devuelve el HttpResponse completo", () => {
    const { $httpBackend, httpClient } = bootHttpClient();
    $httpBackend.expectGET("/api/users/1").respond(200, { id: 1 });

    let result: HttpResponse<unknown> | undefined;
    httpClient.get("/api/users/1", { observe: "response" }).subscribe((value) => {
      result = value as HttpResponse<unknown>;
    });
    $httpBackend.flush();

    expect(result).toBeInstanceOf(HttpResponse);
    expect(result?.status).toBe(200);
    expect(result?.body).toEqual({ id: 1 });
  });

  it("post()/put()/delete()/patch() arman el método y el body correctos", () => {
    const { $httpBackend, httpClient } = bootHttpClient();
    $httpBackend.expectPOST("/api/users", { name: "max" }).respond(201, { id: 1 });
    $httpBackend.expectPUT("/api/users/1", { name: "maxi" }).respond(200, { id: 1 });
    $httpBackend.expectDELETE("/api/users/1").respond(204, "");
    $httpBackend.expectPATCH("/api/users/1", { name: "m" }).respond(200, { id: 1 });

    httpClient.post("/api/users", { name: "max" }).subscribe();
    httpClient.put("/api/users/1", { name: "maxi" }).subscribe();
    httpClient.delete("/api/users/1").subscribe();
    httpClient.patch("/api/users/1", { name: "m" }).subscribe();

    expect(() => $httpBackend.flush()).not.toThrow();
  });

  it("un error de red/status llega como HttpErrorResponse en el error del Observable", () => {
    const { $httpBackend, httpClient } = bootHttpClient();
    $httpBackend.expectGET("/api/boom").respond(500, "boom");

    let error: HttpErrorResponse | undefined;
    httpClient.get("/api/boom").subscribe({ error: (err) => (error = err) });
    $httpBackend.flush();

    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(error?.status).toBe(500);
  });

  it("los interceptors registrados (multi) se aplican en orden, y pueden modificar el request", () => {
    const order: string[] = [];
    const authInterceptor: HttpInterceptor = {
      intercept: (req: HttpRequest<unknown>, next: HttpHandler) => {
        order.push("auth");
        return next.handle(req.clone({ headers: req.headers.set("Authorization", "Bearer x") }));
      },
    };
    const loggingInterceptor: HttpInterceptor = {
      intercept: (req: HttpRequest<unknown>, next: HttpHandler) => {
        order.push("logging");
        return next.handle(req);
      },
    };

    const { $httpBackend, httpClient } = bootHttpClient([authInterceptor, loggingInterceptor]);
    $httpBackend.expectGET("/api/secure", (headers: Record<string, string>) => headers.authorization === "Bearer x").respond(200, {});

    httpClient.get("/api/secure").subscribe();
    $httpBackend.flush();

    expect(order).toEqual(["auth", "logging"]);
  });
});
