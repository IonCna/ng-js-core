import type { Observable } from "rxjs";
import { InjectionToken } from "@/core/di/injection-token.ts";
import type { HttpRequest } from "@/http/http-request.ts";
import type { HttpEvent } from "@/http/http-response.ts";

export interface HttpHandler {
  handle(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>>;
}

export interface HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>>;
}

/** `{ provide: HTTP_INTERCEPTORS, useClass: MiInterceptor, multi: true }` — mismo mecanismo `multi` de etapa 3. */
export const HTTP_INTERCEPTORS = new InjectionToken<HttpInterceptor[]>("HTTP_INTERCEPTORS", { factory: () => [] });

/** Un nodo de la cadena — `next` es el resto de la cadena (el siguiente interceptor, o el backend al final). */
export class HttpInterceptorHandler implements HttpHandler {
  constructor(
    private readonly next: HttpHandler,
    private readonly interceptor: HttpInterceptor,
  ) {}

  handle(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    return this.interceptor.intercept(req, this.next);
  }
}

/**
 * El primer interceptor registrado queda más AFUERA (`i1(i2(i3(backend)))`),
 * mismo orden que Angular real — armado con `reduceRight` para que el
 * ÚLTIMO de la lista quede más cerca del backend.
 */
export function buildInterceptorChain(interceptors: readonly HttpInterceptor[], backendHandler: HttpHandler): HttpHandler {
  return interceptors.reduceRight<HttpHandler>((next, interceptor) => new HttpInterceptorHandler(next, interceptor), backendHandler);
}
