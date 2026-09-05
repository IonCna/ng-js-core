import { map, type Observable } from "rxjs";
import { Injector } from "@/core/di/injector.ts";
import { HttpBackend } from "@/http/http-backend.ts";
import { buildInterceptorChain, HTTP_INTERCEPTORS, type HttpHandler } from "@/http/http-interceptor.ts";
import { HttpParams } from "@/http/http-params.ts";
import type { HttpMethod, HttpObserve, HttpResponseType } from "@/http/http-request.ts";
import { HttpRequest } from "@/http/http-request.ts";
import { HttpHeaders } from "@/http/http-headers.ts";
import { HttpResponse } from "@/http/http-response.ts";

export interface HttpOptions<T = unknown> {
  body?: T;
  headers?: HttpHeaders;
  params?: HttpParams;
  withCredentials?: boolean;
  responseType?: HttpResponseType;
  observe?: HttpObserve;
  timeout?: number;
}

/** `$http` (Promise, con su propio pipeline) queda afuera a propósito — esto pega directo contra `$httpBackend`, ver `docs/CONCEPTOS.md`/`ORDEN-DE-CONSTRUCCION.md`. */
export abstract class HttpClient {
  static readonly $name = "HttpClient";

  abstract request<T = unknown>(method: HttpMethod, url: string, options?: HttpOptions): Observable<T>;
  abstract get<T = unknown>(url: string, options?: HttpOptions): Observable<T>;
  abstract post<T = unknown>(url: string, body: unknown, options?: HttpOptions): Observable<T>;
  abstract put<T = unknown>(url: string, body: unknown, options?: HttpOptions): Observable<T>;
  abstract patch<T = unknown>(url: string, body: unknown, options?: HttpOptions): Observable<T>;
  abstract delete<T = unknown>(url: string, options?: HttpOptions): Observable<T>;
  abstract head<T = unknown>(url: string, options?: HttpOptions): Observable<T>;
}

export class HttpClientImpl extends HttpClient {
  static readonly $inject = [Injector.$name, HttpBackend.$name];

  private readonly chain: HttpHandler;

  constructor(injector: Injector, backend: HttpBackend) {
    super();
    const interceptors = injector.get(HTTP_INTERCEPTORS, []);
    this.chain = buildInterceptorChain(interceptors, backend);
  }

  request<T = unknown>(method: HttpMethod, url: string, options: HttpOptions = {}): Observable<T> {
    const req = new HttpRequest(method, url, options.body ?? null, {
      headers: options.headers ?? new HttpHeaders(),
      params: options.params ?? new HttpParams(),
      withCredentials: options.withCredentials,
      responseType: options.responseType,
      timeout: options.timeout,
    });

    const events$ = this.chain.handle(req);

    // "events"/"response" son iguales acá: sin eventos de progreso (ver
    // http-response.ts), el único evento que existe YA ES el HttpResponse final.
    if (options.observe === "events" || options.observe === "response") {
      return events$ as unknown as Observable<T>;
    }

    return events$.pipe(map((event) => (event as HttpResponse<T>).body as T));
  }

  get<T = unknown>(url: string, options?: HttpOptions): Observable<T> {
    return this.request<T>("GET", url, options);
  }

  post<T = unknown>(url: string, body: unknown, options: HttpOptions = {}): Observable<T> {
    return this.request<T>("POST", url, { ...options, body });
  }

  put<T = unknown>(url: string, body: unknown, options: HttpOptions = {}): Observable<T> {
    return this.request<T>("PUT", url, { ...options, body });
  }

  patch<T = unknown>(url: string, body: unknown, options: HttpOptions = {}): Observable<T> {
    return this.request<T>("PATCH", url, { ...options, body });
  }

  delete<T = unknown>(url: string, options?: HttpOptions): Observable<T> {
    return this.request<T>("DELETE", url, options);
  }

  head<T = unknown>(url: string, options?: HttpOptions): Observable<T> {
    return this.request<T>("HEAD", url, options);
  }
}
