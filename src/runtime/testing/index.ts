/**
 * `ngjs-core/runtime/testing` — arranque de tests estilo `TestBed` sobre
 * `angular.mock`. Reemplaza el `angular.mock.module("nombre.a.mano")` por
 * `angular.mock.module(configureTestingModule({ imports: [FeatureModule] }))`.
 */
import type angular from "angular";
import type { Provider } from "@/core/di/provider.ts";
import { ngModule } from "@/core/metadata/ng-module.ts";
import { CoreModule, installCoreModule } from "@/runtime/core-module.ts";
import { registerNgModule } from "@/runtime/ng-module-runtime.ts";

export interface TestingModuleConfig {
  imports?: (Function | angular.IModule | string)[];
  declarations?: Function[];
  providers?: Provider[];
}

/** Contador de nombres únicos para cada módulo de test. Clase para poder resetear. */
class TestingModuleNames {
  private n = 0;
  next(): string {
    this.n += 1;
    return `ngjs.testing.${this.n}`;
  }
}

const names = new TestingModuleNames();

/**
 * Arma un `@NgModule` ad-hoc con `CoreModule` + lo que se pida, lo registra vía
 * el motor de runtime y devuelve su nombre para pasárselo a `angular.mock.module`.
 * La `NgZone` la resuelve el `.factory` inerte de `CoreModule` (no hace falta
 * `zone.js` ni stub en el test).
 */
export function configureTestingModule(config: TestingModuleConfig = {}): string {
  installCoreModule();

  class TestingModule {}
  ngModule(TestingModule).define({
    id: names.next(),
    imports: [CoreModule, ...(config.imports ?? [])],
    declarations: config.declarations ?? [],
    providers: config.providers ?? [],
  });

  return registerNgModule(TestingModule).name;
}
