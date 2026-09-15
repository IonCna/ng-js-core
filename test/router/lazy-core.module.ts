import { forwardRef } from "@/core/di/forward-ref.ts";
import { Inject } from "@/core/di/injectable.ts";
import { Optional, SkipSelf } from "@/core/di/inject-flags.ts";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { RouterModule } from "@/router/index.ts";

/** Fixtures de #4: clases `@NgModule` instanciadas con DI de constructor. */

export const moduleLog: string[] = [];

export class CoreConfig {
  readonly name = "core-config";
}

/** El guard clásico de Angular: `CoreModule` solo se importa en la app raíz. */
@NgModule({ id: "LazyParityCoreModule", providers: [{ provide: "CoreConfig", useClass: CoreConfig }] })
export class CoreModule {
  constructor(
    @Optional() @SkipSelf() @Inject(forwardRef(() => CoreModule)) parent: CoreModule | null,
    @Inject("CoreConfig") config: CoreConfig,
  ) {
    if (parent) throw new Error("CoreModule ya está cargado: importalo solo en AppModule.");
    moduleLog.push(`core:${config.name}`);
  }
}

@Component({ selector: "bad-page", template: "<h2>bad page</h2>" })
export class BadPage {}

/** Módulo lazy que (mal) vuelve a importar `CoreModule`. */
@NgModule({
  imports: [CoreModule, RouterModule.forChild([{ path: "", component: BadPage }])],
  declarations: [BadPage],
})
export class BadLazyModule {}
