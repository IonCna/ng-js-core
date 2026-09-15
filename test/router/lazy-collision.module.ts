import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { RouterModule } from "@/router/index.ts";

/** Fixture de #2: módulo lazy que declara un selector que la app ya registró (`lp-home`). */

@Component({ selector: "lp-home", template: "<h1>otro home</h1>" })
export class CollidingHome {}

@NgModule({
  imports: [RouterModule.forChild([{ path: "", component: CollidingHome }])],
  declarations: [CollidingHome],
})
export class CollisionModule {}
