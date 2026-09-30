import { concatMap, filter, map, type Observable, of } from "rxjs";
import { Injectable } from "@/core/di/injectable.ts";
import { Injector } from "@/core/di/injector.ts";
import { HttpBackend } from "@/http/http-backend.ts";
import type { HttpContext } from "@/http/http-context.ts";
import { HttpHeaders } from "@/http/http-headers.ts";
import { buildInterceptorChain, HTTP_INTERCEPTORS, HttpHandler, type HttpInterceptor } from "@/http/http-interceptor.ts";
import { HttpParams } from "@/http/http-params.ts";
import type { HttpObserve, HttpResponseType } from "@/http/http-request.ts";
import { HttpRequest } from "@/http/http-request.ts";
import { type HttpEvent, HttpResponse } from "@/http/http-response.ts";
import { HttpXsrfInterceptor, HttpXsrfTokenExtractor, XSRF_ENABLED, XSRF_HEADER_NAME } from "@/http/http-xsrf.ts";

type HeadersInit = HttpHeaders | { [header: string]: string | string[] };
type ParamsInit = HttpParams | { [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean> };

/** Las opciones de `HttpClient` de Angular: `headers`/`params` también como objeto plano. */
export interface HttpOptions<T = unknown> {
  body?: T;
  headers?: HeadersInit;
  context?: HttpContext;
  params?: ParamsInit;
  observe?: HttpObserve;
  reportProgress?: boolean;
  responseType?: HttpResponseType;
  withCredentials?: boolean;
  /** Propio de ngjs: ms hasta cancelar el request. */
  timeout?: number;
}

/**
 * La cadena de interceptors que `HttpClient` recibe por DI (el `HttpInterceptingHandler` de Angular): los
 * `HTTP_INTERCEPTORS` de la app en orden y, más cerca del backend, el de XSRF. Se arma en el primer request.
 */
@Injectable()
export class HttpInterceptingHandler extends HttpHandler {
  private chain: HttpHandler | undefined;

  constructor(
    private readonly backend: HttpBackend,
    private readonly injector: Injector,
  ) {
    super();
  }

  handle(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    if (!this.chain) {
      const interceptors = this.injector.get<HttpInterceptor[]>(HTTP_INTERCEPTORS, []);
      const xsrf = new HttpXsrfInterceptor(
        this.injector.get(XSRF_ENABLED),
        this.injector.get(HttpXsrfTokenExtractor),
        this.injector.get(XSRF_HEADER_NAME),
      );
      this.chain = buildInterceptorChain([...interceptors, xsrf], this.backend);
    }
    return this.chain.handle(req);
  }
}

/**
 * `HttpClient` de `@angular/common/http` sobre `$httpBackend` (`$http` queda afuera a propósito, ver
 * `docs/CONCEPTOS.md`). Como en Angular, recibe un `HttpHandler`: por DI la cadena de interceptors;
 * `new HttpClient(backend)` los saltea.
 */
@Injectable()
export class HttpClient {
  constructor(private readonly handler: HttpHandler) {}

  request<T = unknown>(req: HttpRequest<unknown>): Observable<HttpEvent<T>>;
  request<T = unknown>(method: string, url: string, options?: HttpOptions): Observable<T>;
  request<T = unknown>(first: string | HttpRequest<unknown>, url?: string, options: HttpOptions = {}): Observable<T> {
    const req =
      first instanceof HttpRequest
        ? first
        : new HttpRequest(first, url as string, options.body !== undefined ? options.body : null, {
            headers: options.headers instanceof HttpHeaders ? options.headers : new HttpHeaders(options.headers),
            params: options.params instanceof HttpParams ? options.params : new HttpParams({ fromObject: options.params }),
            context: options.context,
            reportProgress: options.reportProgress,
            responseType: options.responseType,
            withCredentials: options.withCredentials,
            timeout: options.timeout,
          });

    // Como Angular: la cadena de interceptors corre al SUSCRIBIRSE, y otra vez por cada suscripción — un token
    // actualizado entre crear el observable y suscribirse, un reintento o un contador de carga ven cada request.
    const events$ = of(req).pipe(concatMap((request) => this.handler.handle(request)));
    if (first instanceof HttpRequest || options.observe === "events") return events$ as unknown as Observable<T>;

    const responses$ = events$.pipe(filter((event): event is HttpResponse<unknown> => event instanceof HttpResponse));
    if (options.observe === "response") return responses$ as unknown as Observable<T>;
    return responses$.pipe(map((response) => HttpClient.body(response, req.responseType) as T));
  }

  delete<T = unknown>(url: string, options?: HttpOptions): Observable<T> {
    return this.request<T>("DELETE", url, options);
  }

  get<T = unknown>(url: string, options?: HttpOptions): Observable<T> {
    return this.request<T>("GET", url, options);
  }

  head<T = unknown>(url: string, options?: HttpOptions): Observable<T> {
    return this.request<T>("HEAD", url, options);
  }

  options<T = unknown>(url: string, options?: HttpOptions): Observable<T> {
    return this.request<T>("OPTIONS", url, options);
  }

  patch<T = unknown>(url: string, body: unknown, options: HttpOptions = {}): Observable<T> {
    return this.request<T>("PATCH", url, { ...options, body });
  }

  post<T = unknown>(url: string, body: unknown, options: HttpOptions = {}): Observable<T> {
    return this.request<T>("POST", url, { ...options, body });
  }

  put<T = unknown>(url: string, body: unknown, options: HttpOptions = {}): Observable<T> {
    return this.request<T>("PUT", url, { ...options, body });
  }

  /** Como Angular: con `responseType` binario/texto el body tiene que ser de ese tipo. */
  private static body(response: HttpResponse<unknown>, responseType: HttpResponseType): unknown {
    const { body } = response;
    if (responseType === "arraybuffer" && body !== null && !(body instanceof ArrayBuffer)) throw new Error("Response is not an ArrayBuffer.");
    if (responseType === "blob" && body !== null && !(typeof Blob !== "undefined" && body instanceof Blob)) throw new Error("Response is not a Blob.");
    if (responseType === "text" && body !== null && typeof body !== "string") throw new Error("Response is not a string.");
    return body;
  }
}
