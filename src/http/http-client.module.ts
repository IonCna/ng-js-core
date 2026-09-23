import { NgModule } from "@/core/metadata/ng-module.ts";
import { HttpBackend, HttpBackendImpl } from "@/http/http-backend.ts";
import { HttpClient, HttpClientImpl } from "@/http/http-client.ts";

@NgModule({
  providers: [
    { provide: HttpBackend, useClass: HttpBackendImpl },
    { provide: HttpClient, useClass: HttpClientImpl },
  ],
})
export class HttpClientModule {}
