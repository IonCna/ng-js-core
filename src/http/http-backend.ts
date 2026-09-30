import type angular from "angular";
import { Observable } from "rxjs";
import { Inject } from "@/core/di/inject.ts";
import { Injectable } from "@/core/di/injectable.ts";
import { HttpHeaders } from "@/http/http-headers.ts";
import { HttpHandler } from "@/http/http-interceptor.ts";
import type { HttpRequest } from "@/http/http-request.ts";
import { HttpErrorResponse, type HttpEvent, HttpEventType, HttpResponse } from "@/http/http-response.ts";

/**
 * Handler final de la cadena de interceptors — el único que de verdad pega contra la red. Como Angular, se reemplaza
 * por DI (`{ provide: HttpBackend, useClass: ... }`) o se usa directo para saltear los interceptors.
 */
@Injectable()
export abstract class HttpBackend implements HttpHandler {
  abstract handle(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>>;
}

/** El prefijo anti-XSSI que Angular saca antes de parsear JSON (`)]}',` + salto de línea). */
const XSSI_PREFIX = /^\)\]\}',?\n/;

type RawHttpBackend = (
  method: string,
  url: string,
  post: unknown,
  callback: (status: number, response: unknown, headersString: string, statusText: string, xhrStatus?: string) => void,
  headers: Record<string, string>,
  timeout: Promise<void>,
  withCredentials: boolean,
  responseType?: string,
  eventHandlers?: Record<string, (event: ProgressEvent) => void>,
  uploadEventHandlers?: Record<string, (event: ProgressEvent) => void>,
) => void;

/**
 * `HttpXhrBackend` de Angular sobre `$httpBackend` de AngularJS (NO `$http`: sin su pipeline de transform/
 * interceptors, lo arma `HttpClient`). Como el de Angular: emite `Sent` al mandar, progreso con `reportProgress`
 * (`eventHandlers`/`uploadEventHandlers` de `$httpBackend`) y la respuesta; el JSON se pide como texto y se parsea
 * acá (sacando el prefijo XSSI): un 2xx con JSON inválido es un `HttpErrorResponse` "during parsing".
 */
@Injectable()
export class HttpXhrBackend extends HttpBackend {
  constructor(@Inject("$httpBackend") private readonly $httpBackend: angular.IHttpBackendService) {
    super();
  }

  handle(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    return new Observable((subscriber) => {
      // $httpBackend cancela/aborta si "timeout" es una promise que resuelve: se usa SIEMPRE (nunca un número), así
      // el unsubscribe de RxJS cancela la request de verdad, y el `timeout` numérico de ngjs usa el mismo mecanismo.
      let resolveCancel!: () => void;
      const cancelPromise = new Promise<void>((resolve) => {
        resolveCancel = resolve;
      });
      const timeoutHandle = typeof req.timeout === "number" ? setTimeout(resolveCancel, req.timeout) : undefined;

      // Como `HttpXhrBackend` de Angular: el `Content-Type` detectado solo si el dev no mandó uno; `Accept` por defecto.
      const headers = req.headers.toObject();
      if (!req.headers.has("Accept")) headers.Accept = "application/json, text/plain, */*";
      const contentType = req.headers.has("Content-Type") ? null : req.detectContentTypeHeader();
      if (contentType !== null) headers["Content-Type"] = contentType;

      const progress = (type: HttpEventType.DownloadProgress | HttpEventType.UploadProgress) => (event: ProgressEvent) => {
        subscriber.next({ type, loaded: event.loaded, ...(event.lengthComputable && { total: event.total }) });
      };
      const body = req.serializeBody();

      (this.$httpBackend as unknown as RawHttpBackend)(
        req.method,
        req.urlWithParams,
        body,
        (rawStatus, response, headersString, rawStatusText) => {
          const headers = new HttpHeaders(headersString);
          const url = req.urlWithParams;
          // `$httpBackend` da -1 si no hubo respuesta (red caída, abort, timeout); Angular, 0 "Unknown Error".
          const status = rawStatus < 0 ? 0 : rawStatus;
          const statusText = rawStatus < 0 ? "Unknown Error" : rawStatusText;
          let ok = status >= 200 && status < 300;
          let body: unknown = response === undefined ? null : response;

          if (req.responseType === "json" && typeof body === "string") {
            const text = body.replace(XSSI_PREFIX, "");
            try {
              body = text !== "" ? JSON.parse(text) : null;
            } catch (error) {
              body = text;
              if (ok) {
                ok = false;
                body = { error, text };
              }
            }
          }

          if (ok) {
            subscriber.next(new HttpResponse({ body, headers, status, statusText, url }));
            subscriber.complete();
          } else {
            subscriber.error(new HttpErrorResponse({ error: body, headers, status, statusText, url }));
          }
        },
        headers,
        cancelPromise,
        req.withCredentials,
        req.responseType === "json" ? "text" : req.responseType,
        req.reportProgress ? { progress: progress(HttpEventType.DownloadProgress) } : undefined,
        req.reportProgress && body !== null ? { progress: progress(HttpEventType.UploadProgress) } : undefined,
      );
      subscriber.next({ type: HttpEventType.Sent });

      return () => {
        if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
        resolveCancel();
      };
    });
  }
}
