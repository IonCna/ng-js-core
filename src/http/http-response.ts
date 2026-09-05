import type { HttpHeaders } from "@/http/http-headers.ts";

/**
 * Sin eventos de progreso (`Sent`/`UploadProgress`/`DownloadProgress`) —
 * `$httpBackend` no los da salvo enganchando `xhr.upload`/`xhr` a mano, y no
 * hace falta para el MVP (brecha documentada). Solo `Response`, el evento
 * final.
 */
export enum HttpEventType {
  Response = 0,
}

export interface HttpResponseInit<T> {
  status: number;
  statusText: string;
  headers: HttpHeaders;
  url: string | null;
  body: T | null;
}

export class HttpResponse<T = unknown> {
  readonly type = HttpEventType.Response as const;
  readonly status: number;
  readonly statusText: string;
  readonly headers: HttpHeaders;
  readonly url: string | null;
  readonly body: T | null;
  readonly ok: boolean;

  constructor(init: HttpResponseInit<T>) {
    this.status = init.status;
    this.statusText = init.statusText;
    this.headers = init.headers;
    this.url = init.url;
    this.body = init.body;
    this.ok = init.status >= 200 && init.status < 300;
  }
}

export type HttpEvent<T = unknown> = HttpResponse<T>;

export interface HttpErrorResponseInit {
  status: number;
  statusText: string;
  headers: HttpHeaders;
  url: string | null;
  error: unknown;
}

/** Se emite como error del Observable (no como valor), como el real. */
export class HttpErrorResponse extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly headers: HttpHeaders;
  readonly url: string | null;
  readonly error: unknown;
  readonly ok = false as const;

  constructor(init: HttpErrorResponseInit) {
    super(`Http failure response for ${init.url ?? "(unknown url)"}: ${init.status} ${init.statusText}`);
    this.name = "HttpErrorResponse";
    this.status = init.status;
    this.statusText = init.statusText;
    this.headers = init.headers;
    this.url = init.url;
    this.error = init.error;
  }
}
