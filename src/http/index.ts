/**
 * `ngjs-core/common/http` — superficie de `@angular/common/http` sobre `$httpBackend`.
 *
 * Orden por concern, como el `public_api` de `@angular/common/http`: backend → handler/client → contexto → headers →
 * interceptores → params → request → response → XSRF.
 */
export { HttpBackend, HttpXhrBackend } from "@/http/http-backend.ts";
export type { HttpOptions } from "@/http/http-client.ts";
export { HttpClient } from "@/http/http-client.ts";
export { HttpClientModule, HttpClientXsrfModule } from "@/http/http-client.module.ts";
export { HttpContext, HttpContextToken } from "@/http/http-context.ts";
export { HttpHeaders } from "@/http/http-headers.ts";
export type { HttpInterceptor } from "@/http/http-interceptor.ts";
export { HTTP_INTERCEPTORS, HttpHandler } from "@/http/http-interceptor.ts";
export type { HttpParameterCodec, HttpParamsOptions } from "@/http/http-params.ts";
export { HttpParams, HttpUrlEncodingCodec } from "@/http/http-params.ts";
export type { HttpMethod, HttpObserve, HttpRequestInit, HttpResponseType } from "@/http/http-request.ts";
export { HttpRequest } from "@/http/http-request.ts";
export type {
  HttpDownloadProgressEvent,
  HttpErrorResponseInit,
  HttpEvent,
  HttpProgressEvent,
  HttpResponseInit,
  HttpSentEvent,
  HttpUploadProgressEvent,
  HttpUserEvent,
} from "@/http/http-response.ts";
export { HttpErrorResponse, HttpEventType, HttpHeaderResponse, HttpResponse, HttpResponseBase } from "@/http/http-response.ts";
export { HttpStatusCode } from "@/http/http-status-code.ts";
export { HttpXsrfTokenExtractor } from "@/http/http-xsrf.ts";
