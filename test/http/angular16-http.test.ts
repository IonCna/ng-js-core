import angular from "angular";
import { lastValueFrom, toArray } from "rxjs";
import { describe, expect, it } from "vitest";
import { HttpXhrBackend } from "@/http/http-backend.ts";
import { HttpClient } from "@/http/http-client.ts";
import { HttpContext, HttpContextToken } from "@/http/http-context.ts";
import { HttpHeaders } from "@/http/http-headers.ts";
import { HttpParams } from "@/http/http-params.ts";
import { HttpRequest } from "@/http/http-request.ts";
import { HttpErrorResponse, HttpEventType, HttpResponse } from "@/http/http-response.ts";
import { HttpStatusCode } from "@/http/http-status-code.ts";

type MockBackend = angular.IHttpBackendService & {
  flush(): void;
  expectGET(url: string | RegExp, headers?: unknown): { respond(status: number, data?: unknown, headers?: unknown): void };
  expectPOST(url: string, data?: unknown, headers?: unknown): { respond(status: number, data?: unknown): void };
};

function boot(): { $httpBackend: MockBackend; http: HttpClient } {
  const $httpBackend = angular.injector(["ng", "ngMock"]).get<MockBackend>("$httpBackend");
  return { $httpBackend, http: new HttpClient(new HttpXhrBackend($httpBackend)) };
}

describe("HttpParams como Angular 16", () => {
  it("fromObject/fromString, la codificación de Angular (deja @ : $ , ; = ? / sin escapar), appendAll y delete(param, value)", () => {
    const params = new HttpParams({ fromObject: { q: "a b@c:d/e", tag: ["x", "y"] } });
    expect(params.toString()).toBe("q=a%20b@c:d/e&tag=x&tag=y");
    expect(new HttpParams({ fromString: "?a=1&a=2&b" }).getAll("a")).toEqual(["1", "2"]);
    expect(params.appendAll({ tag: "z", page: 2 }).toString()).toBe("q=a%20b@c:d/e&tag=x&tag=y&tag=z&page=2");
    expect(params.delete("tag", "x").getAll("tag")).toEqual(["y"]);
    expect(() => new HttpParams({ fromString: "a=1", fromObject: {} })).toThrow("Cannot specify both fromString and fromObject.");
  });
});

describe("HttpRequest como Angular 16", () => {
  it("GET toma el tercer argumento como opciones; POST, como body; urlWithParams es propiedad", () => {
    const get = new HttpRequest("GET", "/api", { params: new HttpParams({ fromObject: { page: 2 } }) });
    expect(get.body).toBeNull();
    expect(get.urlWithParams).toBe("/api?page=2");
    const post = new HttpRequest("POST", "/api", { name: "x" });
    expect(post.body).toEqual({ name: "x" });
  });

  it("clone con setHeaders/setParams y el HttpContext viaja con el request", () => {
    const CACHE = new HttpContextToken(() => true);
    const req = new HttpRequest("GET", "/api", { context: new HttpContext().set(CACHE, false) });
    const clone = req.clone({ setHeaders: { Authorization: "Bearer x" }, setParams: { a: "1" } });
    expect(clone.headers.get("Authorization")).toBe("Bearer x");
    expect(clone.urlWithParams).toBe("/api?a=1");
    expect(clone.context.get(CACHE)).toBe(false);
    expect(new HttpContext().get(CACHE)).toBe(true);
  });
});

describe("HttpClient/HttpXhrBackend como Angular 16", () => {
  it("headers y params como objeto plano", () => {
    const { $httpBackend, http } = boot();
    $httpBackend.expectGET("/api?page=1&tag=a&tag=b", (headers: Record<string, string>) => headers["X-Id"] === "7").respond(200, []);
    let body: unknown;
    http.get("/api", { params: { page: 1, tag: ["a", "b"] }, headers: { "X-Id": "7" } }).subscribe((value) => (body = value));
    $httpBackend.flush();
    expect(body).toEqual([]);
  });

  it("observe: 'events' y request(HttpRequest) emiten Sent y después la respuesta (HttpEventType de Angular)", async () => {
    const { $httpBackend, http } = boot();
    $httpBackend.expectGET("/api").respond(200, { ok: true });
    const events = lastValueFrom(http.request(new HttpRequest("GET", "/api")).pipe(toArray()));
    $httpBackend.flush();
    const [sent, response] = await events;
    expect(sent).toEqual({ type: HttpEventType.Sent });
    expect(response).toBeInstanceOf(HttpResponse);
    expect([HttpEventType.Sent, HttpEventType.Response]).toEqual([0, 4]);
  });

  it("JSON: saca el prefijo XSSI; un 2xx con JSON inválido es HttpErrorResponse 'during parsing'", () => {
    const { $httpBackend, http } = boot();
    $httpBackend.expectGET("/ok").respond(200, ")]}',\n{\"a\":1}");
    $httpBackend.expectGET("/bad").respond(200, "{no es json");
    let ok: unknown;
    let error: HttpErrorResponse | undefined;
    http.get("/ok").subscribe((value) => (ok = value));
    http.get("/bad").subscribe({ error: (value) => (error = value) });
    $httpBackend.flush();
    expect(ok).toEqual({ a: 1 });
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(error?.status).toBe(200);
    expect(error?.message).toBe("Http failure during parsing for /bad");
    expect((error?.error as { text: string }).text).toBe("{no es json");
  });

  it("un 4xx llega con el body de error parseado y el mensaje de Angular; HttpErrorResponse no es un Error", () => {
    const { $httpBackend, http } = boot();
    $httpBackend.expectGET("/missing").respond(404, "{\"reason\":\"no\"}");
    let error: HttpErrorResponse | undefined;
    http.get("/missing").subscribe({ error: (value) => (error = value) });
    $httpBackend.flush();
    expect(error?.status).toBe(HttpStatusCode.NotFound);
    expect(error?.error).toEqual({ reason: "no" });
    expect(error?.message).toMatch(/^Http failure response for \/missing: 404/);
    expect(error).not.toBeInstanceOf(Error);
    expect(error?.name).toBe("HttpErrorResponse");
  });

  it("HttpResponse con los defaults de Angular (200 OK) y clone()", () => {
    const response = new HttpResponse({ body: { a: 1 } });
    expect([response.status, response.statusText, response.ok, response.headers instanceof HttpHeaders]).toEqual([200, "OK", true, true]);
    expect(response.clone({ body: { a: 2 } }).body).toEqual({ a: 2 });
  });
});
