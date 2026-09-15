import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { RouterModule } from "@/router/index.ts";

/** Módulo con `forChild` importado eager por la app Y por un `@NgModule` lazy. */

@Component({ selector: "shared-page", template: "<h2>shared page</h2>" })
export class SharedPage {}

@NgModule({
  imports: [RouterModule.forChild([{ path: "shared", component: SharedPage }])],
  declarations: [SharedPage],
})
export class SharedRoutesModule {}
