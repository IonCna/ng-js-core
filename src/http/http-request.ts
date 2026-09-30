import { HttpContext } from "@/http/http-context.ts";
import { HttpHeaders } from "@/http/http-headers.ts";
import { HttpParams } from "@/http/http-params.ts";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS" | "JSONP";
export type HttpObserve = "body" | "response" | "events";
export type HttpResponseType = "json" | "text" | "blob" | "arraybuffer";

export interface HttpRequestInit {
  headers?: HttpHeaders;
  context?: HttpContext;
  reportProgress?: boolean;
  params?: HttpParams;
  withCredentials?: boolean;
  responseType?: HttpResponseType;
  /** Propio de ngjs: número de ms; también se cancela desabonándose del Observable — ver `http-backend.ts`. */
  timeout?: number;
}

export interface HttpRequestUpdate<T> extends HttpRequestInit {
  body?: T | null;
  method?: string;
  url?: string;
  /** Headers a poner encima de los actuales (`req.clone({ setHeaders: { Authorization: "..." } })`). */
  setHeaders?: { [name: string]: string | string[] };
  /** Params a poner encima de los actuales. */
  setParams?: { [param: string]: string };
}

/** Como Angular: estos métodos no llevan body, así que su tercer argumento son las opciones. */
function mightHaveBody(method: string): boolean {
  return !["DELETE", "GET", "HEAD", "OPTIONS", "JSONP"].includes(method.toUpperCase());
}

/**
 * `HttpRequest` de `@angular/common/http`, inmutable — `clone()` es lo único que usan los interceptors para
 * "modificarlo". Mismo constructor que Angular: `new HttpRequest("GET", url, init?)` o
 * `new HttpRequest("POST", url, body, init?)`.
 */
export class HttpRequest<T = unknown> {
  readonly body: T | null;
  readonly headers: HttpHeaders;
  readonly context: HttpContext;
  readonly reportProgress: boolean;
  readonly withCredentials: boolean;
  readonly responseType: HttpResponseType;
  readonly method: string;
  readonly params: HttpParams;
  /** La URL de verdad a pedir — `params` ya anexados como query string. */
  readonly urlWithParams: string;
  readonly timeout?: number;

  constructor(method: HttpMethod | string, url: string, init?: HttpRequestInit);
  constructor(method: HttpMethod | string, url: string, body: T | null, init?: HttpRequestInit);
  constructor(
    method: HttpMethod | string,
    readonly url: string,
    third?: T | null | HttpRequestInit,
    fourth?: HttpRequestInit,
  ) {
    this.method = method.toUpperCase();
    let init: HttpRequestInit | undefined;
    if (mightHaveBody(this.method) || fourth !== undefined) {
      this.body = third !== undefined ? (third as T | null) : null;
      init = fourth;
    } else {
      this.body = null;
      init = third as HttpRequestInit | undefined;
    }
    this.headers = init?.headers ?? new HttpHeaders();
    this.context = init?.context ?? new HttpContext();
    this.reportProgress = !!init?.reportProgress;
    this.withCredentials = !!init?.withCredentials;
    this.responseType = init?.responseType ?? "json";
    this.params = init?.params ?? new HttpParams();
    this.timeout = init?.timeout;

    const query = this.params.toString();
    if (!query) this.urlWithParams = url;
    else {
      const index = url.indexOf("?");
      const separator = index === -1 ? "?" : index < url.length - 1 ? "&" : "";
      this.urlWithParams = url + separator + query;
    }
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

  clone<V = T>(update: HttpRequestUpdate<V> = {}): HttpRequest<V> {
    const method = update.method ?? this.method;
    const body = update.body !== undefined ? update.body : (this.body as unknown as V | null);
    let headers = update.headers ?? this.headers;
    let params = update.params ?? this.params;
    if (update.setHeaders) {
      for (const [name, value] of Object.entries(update.setHeaders)) headers = headers.set(name, value);
    }
    if (update.setParams) {
      for (const [param, value] of Object.entries(update.setParams)) params = params.set(param, value);
    }
    return new HttpRequest<V>(method, update.url ?? this.url, body, {
      headers,
      params,
      context: update.context ?? this.context,
      reportProgress: update.reportProgress ?? this.reportProgress,
      withCredentials: update.withCredentials ?? this.withCredentials,
      responseType: update.responseType ?? this.responseType,
      timeout: update.timeout ?? this.timeout,
    });
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
