import { HttpHeaders } from "@/http/http-headers.ts";
import { HttpParams } from "@/http/http-params.ts";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS" | "JSONP";
export type HttpObserve = "body" | "response" | "events";
export type HttpResponseType = "json" | "text" | "blob" | "arraybuffer";

export interface HttpRequestInit {
  headers?: HttpHeaders;
  params?: HttpParams;
  withCredentials?: boolean;
  responseType?: HttpResponseType;
  /** Número: se convierte en timeout real; también puede cancelarse desabonándose del Observable — ver `http-backend.ts`. */
  timeout?: number;
}

/** Inmutable — `clone()` es lo único que usan los interceptors para "modificar" un request. */
export class HttpRequest<T = unknown> {
  readonly headers: HttpHeaders;
  readonly params: HttpParams;
  readonly withCredentials: boolean;
  readonly responseType: HttpResponseType;
  readonly timeout?: number;

  constructor(
    public readonly method: HttpMethod,
    public readonly url: string,
    public readonly body: T | null = null,
    init: HttpRequestInit = {},
  ) {
    this.headers = init.headers ?? new HttpHeaders();
    this.params = init.params ?? new HttpParams();
    this.withCredentials = init.withCredentials ?? false;
    this.responseType = init.responseType ?? "json";
    this.timeout = init.timeout;
  }

  /** La URL de verdad a pedir — `params` ya anexados como query string. */
  urlWithParams(): string {
    const query = this.params.toString();
    if (!query) return this.url;
    return this.url + (this.url.includes("?") ? "&" : "?") + query;
  }

  clone(update: Partial<HttpRequestInit & { method: HttpMethod; url: string; body: T | null }> = {}): HttpRequest<T> {
    return new HttpRequest(update.method ?? this.method, update.url ?? this.url, "body" in update ? (update.body ?? null) : this.body, {
      headers: update.headers ?? this.headers,
      params: update.params ?? this.params,
      withCredentials: update.withCredentials ?? this.withCredentials,
      responseType: update.responseType ?? this.responseType,
      timeout: update.timeout ?? this.timeout,
    });
  }
}
