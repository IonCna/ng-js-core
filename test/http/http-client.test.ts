import angular from "angular";
import { describe, expect, it } from "vitest";
import { HttpXhrBackend } from "@/http/http-backend.ts";
import { HttpClient } from "@/http/http-client.ts";
import { buildInterceptorChain, type HttpHandler, type HttpInterceptor } from "@/http/http-interceptor.ts";
import type { HttpRequest } from "@/http/http-request.ts";
import { HttpErrorResponse, HttpResponse } from "@/http/http-response.ts";

/**
 * `HttpClient` construido a mano sobre el `$httpBackend` de `ngMock`: los interceptors llegan por el `Injector`
 * (`buildInterceptorChain`). Que `HttpClientModule` lo provea por DI con los interceptors `multi` lo
 * cubre `http.compiled.test.ts`.
 */
function bootHttpClient(interceptors: HttpInterceptor[] = []): {
  $httpBackend: angular.IHttpBackendService & { flush(): void; expectGET: Function; expectPOST: Function; expectPUT: Function; expectDELETE: Function; expectPATCH: Function };
  httpClient: HttpClient;
} {
  const $injector = angular.injector(["ng", "ngMock"]);
  const $httpBackend = $injector.get<angular.IHttpBackendService>("$httpBackend");
  return { $httpBackend: $httpBackend as never, httpClient: new HttpClient(buildInterceptorChain(interceptors, new HttpXhrBackend($httpBackend))) };
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
    $httpBackend.expectGET("/api/secure", (headers: Record<string, string>) => headers.Authorization === "Bearer x").respond(200, {});

    httpClient.get("/api/secure").subscribe();
    $httpBackend.flush();

    expect(order).toEqual(["auth", "logging"]);
  });

  it("sin suscribirse no corre ningún interceptor (como Angular: la cadena corre al suscribirse)", () => {
    let calls = 0;
    const counter: HttpInterceptor = {
      intercept: (req: HttpRequest<unknown>, next: HttpHandler) => {
        calls++;
        return next.handle(req);
      },
    };

    const { httpClient } = bootHttpClient([counter]);
    httpClient.get("/api/lazy");

    expect(calls).toBe(0);
  });

  it("cada suscripción corre la cadena de nuevo: un token actualizado después de crear el observable se usa", () => {
    let token = "viejo";
    const sent: string[] = [];
    const auth: HttpInterceptor = {
      intercept: (req: HttpRequest<unknown>, next: HttpHandler) => next.handle(req.clone({ headers: req.headers.set("Authorization", token) })),
    };

    const { $httpBackend, httpClient } = bootHttpClient([auth]);
    const record = (headers: Record<string, string>) => {
      sent.push(headers.Authorization!);
      return true;
    };
    $httpBackend.expectGET("/api/me", record).respond(200, {});
    $httpBackend.expectGET("/api/me", record).respond(200, {});

    const me$ = httpClient.get("/api/me");
    token = "nuevo";
    me$.subscribe();
    me$.subscribe();
    $httpBackend.flush();

    expect(sent).toEqual(["nuevo", "nuevo"]);
  });
});
