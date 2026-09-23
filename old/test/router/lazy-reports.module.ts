import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { RouterModule } from "@/router/index.ts";
import { SharedRoutesModule } from "./lazy-shared.module.ts";

/** Chunk lazy que importa un módulo con `forChild` ya cargado eager por la app. */

@Component({ selector: "reports-home", template: "<h2>reports home</h2>" })
export class ReportsHome {}

@NgModule({
  imports: [SharedRoutesModule, RouterModule.forChild([{ path: "home", component: ReportsHome }])],
  declarations: [ReportsHome],
})
export class ReportsModule {}
