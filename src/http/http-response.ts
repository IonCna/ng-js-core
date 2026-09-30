import { HttpHeaders } from "@/http/http-headers.ts";

/** Como `@angular/common/http` (mismos valores). */
export enum HttpEventType {
  Sent = 0,
  UploadProgress = 1,
  ResponseHeader = 2,
  DownloadProgress = 3,
  Response = 4,
  User = 5,
}

/** El request salió (el primer evento de `observe: "events"`). */
export interface HttpSentEvent {
  type: HttpEventType.Sent;
}

/** Un evento propio que emite un interceptor. */
export interface HttpUserEvent<_T> {
  type: HttpEventType.User;
}

/** Progreso de subida/bajada (con `reportProgress: true`). */
export interface HttpProgressEvent {
  type: HttpEventType.DownloadProgress | HttpEventType.UploadProgress;
  loaded: number;
  total?: number;
}

export interface HttpDownloadProgressEvent extends HttpProgressEvent {
  type: HttpEventType.DownloadProgress;
  partialText?: string;
}

export interface HttpUploadProgressEvent extends HttpProgressEvent {
  type: HttpEventType.UploadProgress;
}

export interface HttpResponseBaseInit {
  headers?: HttpHeaders;
  status?: number;
  statusText?: string;
  url?: string | null;
}

/** Lo común a `HttpResponse`, `HttpHeaderResponse` y `HttpErrorResponse` (defaults de Angular: 200 "OK"). */
export abstract class HttpResponseBase {
  readonly headers: HttpHeaders;
  readonly status: number;
  readonly statusText: string;
  readonly url: string | null;
  readonly ok: boolean;
  abstract readonly type: HttpEventType.Response | HttpEventType.ResponseHeader;

  constructor(init: HttpResponseBaseInit, defaultStatus = 200, defaultStatusText = "OK") {
    this.headers = init.headers ?? new HttpHeaders();
    this.status = init.status ?? defaultStatus;
    this.statusText = init.statusText ?? defaultStatusText;
    this.url = init.url ?? null;
    this.ok = this.status >= 200 && this.status < 300;
  }
}

/** Solo status y headers, antes del body (`observe: "events"` con `reportProgress`). */
export class HttpHeaderResponse extends HttpResponseBase {
  readonly type = HttpEventType.ResponseHeader as const;

  clone(update: HttpResponseBaseInit = {}): HttpHeaderResponse {
    return new HttpHeaderResponse({
      headers: update.headers ?? this.headers,
      status: update.status ?? this.status,
      statusText: update.statusText ?? this.statusText,
      url: update.url ?? this.url ?? undefined,
    });
  }
}

export interface HttpResponseInit<T> extends HttpResponseBaseInit {
  body?: T | null;
}

export class HttpResponse<T = unknown> extends HttpResponseBase {
  readonly type = HttpEventType.Response as const;
  readonly body: T | null;

  constructor(init: HttpResponseInit<T> = {}) {
    super(init);
    this.body = init.body !== undefined ? init.body : null;
  }

  clone<V = T>(update: HttpResponseInit<V> = {}): HttpResponse<V> {
    return new HttpResponse<V>({
      body: update.body !== undefined ? update.body : (this.body as unknown as V),
      headers: update.headers ?? this.headers,
      status: update.status ?? this.status,
      statusText: update.statusText ?? this.statusText,
      url: update.url ?? this.url ?? undefined,
    });
  }
}

export type HttpEvent<T = unknown> = HttpSentEvent | HttpHeaderResponse | HttpResponse<T> | HttpProgressEvent | HttpUserEvent<T>;

export interface HttpErrorResponseInit extends HttpResponseBaseInit {
  error?: unknown;
}

/**
 * Se emite como error del Observable, como en Angular: no extiende `Error` (implementa su forma, `name`/`message`).
 * Un 2xx que no se pudo parsear también llega acá ("Http failure during parsing").
 */
export class HttpErrorResponse extends HttpResponseBase implements Error {
  readonly name = "HttpErrorResponse";
  readonly message: string;
  readonly error: unknown;
  override readonly ok = false;
  readonly type = HttpEventType.Response as const;

  constructor(init: HttpErrorResponseInit) {
    super(init, 0, "Unknown Error");
    const url = init.url || "(unknown url)";
    this.message =
      this.status >= 200 && this.status < 300
        ? `Http failure during parsing for ${url}`
        : `Http failure response for ${url}: ${this.status} ${init.statusText ?? ""}`;
    this.error = init.error ?? null;
  }
}
