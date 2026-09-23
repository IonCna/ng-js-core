/**
 * `ngjs-core/http` — superficie de `@angular/common/http` sobre `$httpBackend`.
 * No tiene subpath propio: se consume desde la raíz (`ngjs-core`) — ver
 * `docs/CAPAS.md` ("http / pipes: solo desde la raíz").
 *
 * Orden por concern, como el `public_api` de `@angular/common/http`: backend →
 * handler/client → headers → interceptores → params → request → response.
 */
export { HttpBackend } from "@/http/http-backend.ts";
export { HttpClient } from "@/http/http-client.ts";
export type { HttpOptions } from "@/http/http-client.ts";
export { HttpHeaders } from "@/http/http-headers.ts";
export { HTTP_INTERCEPTORS } from "@/http/http-interceptor.ts";
export type { HttpHandler, HttpInterceptor } from "@/http/http-interceptor.ts";
export { HttpParams } from "@/http/http-params.ts";
export { HttpRequest } from "@/http/http-request.ts";
export type { HttpMethod, HttpObserve, HttpRequestInit, HttpResponseType } from "@/http/http-request.ts";
export { HttpErrorResponse, HttpEventType, HttpResponse } from "@/http/http-response.ts";
export type { HttpErrorResponseInit, HttpEvent, HttpResponseInit } from "@/http/http-response.ts";
