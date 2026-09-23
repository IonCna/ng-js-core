import type angular from "angular";
import { Observable } from "rxjs";
import { HttpHeaders } from "@/http/http-headers.ts";
import type { HttpRequest } from "@/http/http-request.ts";
import { type HttpEvent, HttpErrorResponse, HttpResponse } from "@/http/http-response.ts";

/**
 * Handler final de la cadena de interceptors — el único que de verdad pega
 * contra la red, vía `$httpBackend` (NO `$http`: sin su propio pipeline de
 * transformRequest/transformResponse/interceptors, lo armamos nosotros).
 */
export abstract class HttpBackend {
  static readonly $name = "HttpBackend";
  abstract handle(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>>;
}

export class HttpBackendImpl extends HttpBackend {
  static readonly $inject = ["$httpBackend"];

  constructor(private readonly $httpBackend: angular.IHttpBackendService) {
    super();
  }

  handle(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    return new Observable((subscriber) => {
      // $httpBackend cancela/aborta si "timeout" es una promise que resuelve
      // (ver su fuente real) — la usamos SIEMPRE (nunca un número directo),
      // así el unsubscribe de RxJS cancela la request de verdad, y un
      // timeout numérico se implementa arriba con el mismo mecanismo.
      let resolveCancel!: () => void;
      const cancelPromise = new Promise<void>((resolve) => {
        resolveCancel = resolve;
      });
      const timeoutHandle = typeof req.timeout === "number" ? setTimeout(resolveCancel, req.timeout) : undefined;

      const rawBackend = this.$httpBackend as unknown as (
        method: string,
        url: string,
        post: unknown,
        callback: (status: number, response: unknown, headersString: string, statusText: string) => void,
        headers: Record<string, string>,
        timeout: Promise<void>,
        withCredentials: boolean,
        responseType?: string,
      ) => void;

      rawBackend(
        req.method,
        req.urlWithParams(),
        req.body,
        (status, response, headersString, statusText) => {
          const headers = new HttpHeaders(headersString);
          const url = req.urlWithParams();

          if (status >= 200 && status < 300) {
            subscriber.next(new HttpResponse({ status, statusText, headers, url, body: response as unknown }));
            subscriber.complete();
          } else {
            subscriber.error(new HttpErrorResponse({ status, statusText, headers, url, error: response }));
          }
        },
        req.headers.toObject(),
        cancelPromise,
        req.withCredentials,
        req.responseType === "json" ? "json" : req.responseType,
      );

      return () => {
        if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
        resolveCancel();
      };
    });
  }
}
