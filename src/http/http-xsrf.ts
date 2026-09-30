import type { Observable } from "rxjs";
import { Inject, inject } from "@/core/di/inject.ts";
import { Injectable } from "@/core/di/injectable.ts";
import { InjectionToken } from "@/core/di/injection-token.ts";
import { DOCUMENT } from "@/core/dom-tokens.ts";
import type { HttpHandler, HttpInterceptor } from "@/http/http-interceptor.ts";
import type { HttpRequest } from "@/http/http-request.ts";
import type { HttpEvent } from "@/http/http-response.ts";

/** Configuración de XSRF (internas, como en Angular): la cambian `HttpClientXsrfModule.withOptions()`/`disable()`. */
export const XSRF_ENABLED = new InjectionToken<boolean>("XSRF_ENABLED", { factory: () => true });
export const XSRF_COOKIE_NAME = new InjectionToken<string>("XSRF_COOKIE_NAME", { factory: () => "XSRF-TOKEN" });
export const XSRF_HEADER_NAME = new InjectionToken<string>("XSRF_HEADER_NAME", { factory: () => "X-XSRF-TOKEN" });

/** Lee la cookie XSRF de `document.cookie` (el `HttpXsrfCookieExtractor` de Angular). */
@Injectable()
export class HttpXsrfCookieExtractor {
  private lastCookieString: string | null = null;
  private lastToken: string | null = null;

  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    @Inject(XSRF_COOKIE_NAME) private readonly cookieName: string,
  ) {}

  getToken(): string | null {
    const cookieString = this.document.cookie || "";
    if (cookieString !== this.lastCookieString) {
      this.lastToken = HttpXsrfCookieExtractor.parseCookieValue(cookieString, this.cookieName);
      this.lastCookieString = cookieString;
    }
    return this.lastToken;
  }

  private static parseCookieValue(cookieString: string, name: string): string | null {
    const target = encodeURIComponent(name);
    for (const cookie of cookieString.split(";")) {
      const index = cookie.indexOf("=");
      const [key, value] = index === -1 ? [cookie, ""] : [cookie.slice(0, index), cookie.slice(index + 1)];
      if (key.trim() === target) return decodeURIComponent(value);
    }
    return null;
  }
}

/** De dónde sale el token XSRF — reemplazable por DI (`{ provide: HttpXsrfTokenExtractor, useClass: ... }`). */
@Injectable({
  providedIn: "root",
  useFactory: () => new HttpXsrfCookieExtractor(inject(DOCUMENT), inject(XSRF_COOKIE_NAME)),
})
export abstract class HttpXsrfTokenExtractor {
  abstract getToken(): string | null;
}

/**
 * Como el de Angular (activo por defecto con `HttpClientModule`): en los requests que modifican (no GET/HEAD) a una
 * URL relativa, manda el token de la cookie en el header (salvo que el request ya lo traiga). No se mandan a otro
 * origen, igual que Angular.
 */
export class HttpXsrfInterceptor implements HttpInterceptor {
  constructor(
    private readonly enabled: boolean,
    private readonly tokenExtractor: HttpXsrfTokenExtractor,
    private readonly headerName: string,
  ) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const url = req.url.toLowerCase();
    if (!this.enabled || req.method === "GET" || req.method === "HEAD" || url.startsWith("http://") || url.startsWith("https://")) {
      return next.handle(req);
    }
    const token = this.tokenExtractor.getToken();
    if (token !== null && !req.headers.has(this.headerName)) {
      return next.handle(req.clone({ headers: req.headers.set(this.headerName, token) }));
    }
    return next.handle(req);
  }
}
