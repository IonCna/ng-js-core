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

  /**
   * Lo que de verdad viaja en `xhr.send()`, como `HttpRequest.serializeBody()` de Angular: sin esto el `$httpBackend`
   * nativo manda el objeto crudo y el navegador lo convierte en `"[object Object]"` (acá no pasa por el
   * `transformRequest` de `$http`). Lo que el navegador ya sabe mandar (`FormData`, `Blob`, …) pasa sin tocar.
   */
  serializeBody(): ArrayBuffer | Blob | FormData | URLSearchParams | string | null {
    const body = this.body as unknown;
    if (body === null || body === undefined) return null;
    if (typeof body === "string" || isArrayBuffer(body) || isBlob(body) || isFormData(body) || isUrlSearchParams(body)) {
      return body;
    }
    if (body instanceof HttpParams) return body.toString();
    if (typeof body === "object" || typeof body === "number" || typeof body === "boolean") return JSON.stringify(body);
    return String(body);
  }

  /**
   * El `Content-Type` que corresponde al body cuando el dev no mandó uno, como `detectContentTypeHeader()` de
   * Angular. `null` = que lo ponga el navegador (el boundary de `FormData`, el de `URLSearchParams`).
   */
  detectContentTypeHeader(): string | null {
    const body = this.body as unknown;
    if (body === null || body === undefined) return null;
    if (isFormData(body) || isArrayBuffer(body) || isUrlSearchParams(body)) return null;
    if (isBlob(body)) return body.type || null;
    if (typeof body === "string") return "text/plain";
    if (body instanceof HttpParams) return "application/x-www-form-urlencoded;charset=UTF-8";
    if (typeof body === "object" || typeof body === "number" || typeof body === "boolean") return "application/json";
    return null;
  }

  clone(update: Partial<HttpRequestInit & { method: HttpMethod; url: string; body: T | null }> = {}): HttpRequest<T> {
    return new HttpRequest(
      update.method ?? this.method,
      update.url ?? this.url,
      "body" in update ? (update.body ?? null) : this.body,
      {
        headers: update.headers ?? this.headers,
        params: update.params ?? this.params,
        withCredentials: update.withCredentials ?? this.withCredentials,
        responseType: update.responseType ?? this.responseType,
        timeout: update.timeout ?? this.timeout,
      },
    );
  }
}

// `typeof X !== "undefined"`: no todos los entornos tienen estos globales (tests en node, workers).
function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer;
}

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function isUrlSearchParams(value: unknown): value is URLSearchParams {
  return typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams;
}
