import { inject } from "@/core/di/inject.ts";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { RouterModule } from "@/router/index.ts";

/** Módulo lazy cargado bajo una ruta con `providers`: su injector es hijo del de la ruta. */

@Component({ selector: "rp-lazy-page", controllerAs: "$ctrl", template: "<p class='lazy-rp'>{{ $ctrl.text }}</p>" })
export class RpLazyPage {
  text = `${inject<string>("Tenant")}/${inject<string>("LazyOnly")}`;
}

@NgModule({
  imports: [RouterModule.forChild([{ path: "", component: RpLazyPage }])],
  declarations: [RpLazyPage],
  providers: [{ provide: "LazyOnly", useValue: "lazy-only" }],
})
export class RpLazyModule {}
