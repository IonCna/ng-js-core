import { NgModule } from "@/core/metadata/ng-module.ts";
import { NativeModule } from "@/native/native.module.ts";

/** Módulo base de NgJS; los bridges viven en el módulo native de AngularJS. */
@NgModule({
  imports: [NativeModule],
})
export class CoreModule {}
