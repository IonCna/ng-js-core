import { of } from "rxjs";
import { describe, expect, it } from "vitest";
import { buildInterceptorChain, type HttpHandler, type HttpInterceptor } from "@/http/http-interceptor.ts";
import { HttpRequest } from "@/http/http-request.ts";
import { HttpResponse } from "@/http/http-response.ts";

function fakeBackend(): HttpHandler {
  return {
    handle: (req) => of(new HttpResponse({ status: 200, statusText: "OK", headers: req.headers as never, url: req.url, body: req })),
  };
}

describe("etapa 13 — buildInterceptorChain", () => {
  it("el primero registrado queda más AFUERA — corre primero en la request, último en la respuesta", async () => {
    const order: string[] = [];
    const interceptors = [1, 2, 3].map((n) => ({
      intercept: (req: HttpRequest<unknown>, next: HttpHandler) => {
        order.push(`i${n}:before`);
        const result = next.handle(req);
        order.push(`i${n}:after`);
        return result;
      },
    }));

    const chain = buildInterceptorChain(interceptors, fakeBackend());
    await new Promise<void>((resolve) => {
      chain.handle(new HttpRequest("GET", "/x")).subscribe({ complete: resolve });
    });

    // "before" en orden 1,2,3 (i1 afuera, corre primero); "after" se desenvuelve
    // al revés porque next.handle() es SÍNCRONO acá (of() emite inline) — cada
    // interceptor arma su "after" apenas next.handle() vuelve, de adentro
    // hacia afuera: 3, 2, 1.
    expect(order).toEqual(["i1:before", "i2:before", "i3:before", "i3:after", "i2:after", "i1:after"]);
  });

  it("un interceptor puede modificar el request antes de pasarlo (vía clone())", async () => {
    const seenHeaders: string[] = [];
    const backend: HttpHandler = {
      handle: (req) => {
        seenHeaders.push(req.headers.get("x-auth") ?? "(sin header)");
        return of(new HttpResponse({ status: 200, statusText: "OK", headers: req.headers, url: req.url, body: null }));
      },
    };

    const authInterceptor: HttpInterceptor = {
      intercept: (req, next) => next.handle(req.clone({ headers: req.headers.set("x-auth", "token-123") })),
    };

    const chain = buildInterceptorChain([authInterceptor], backend);
    await new Promise<void>((resolve) => {
      chain.handle(new HttpRequest("GET", "/x")).subscribe({ complete: resolve });
    });

    expect(seenHeaders).toEqual(["token-123"]);
  });

  it("sin interceptors, la cadena es directo el backend", async () => {
    const backend = fakeBackend();
    const chain = buildInterceptorChain([], backend);
    expect(chain).toBe(backend);
  });
});
