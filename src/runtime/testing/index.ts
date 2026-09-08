/**
 * `ngjs-core/runtime/testing` — arranque de tests estilo `TestBed` sobre
 * `angular.mock`. Reemplaza el `angular.mock.module("nombre.a.mano")` por
 * `angular.mock.module(configureTestingModule({ imports: [FeatureModule] }))`.
 */
import type angular from "angular";
import type { Provider } from "@/core/di/provider.ts";
import { RootSingletonRegistry } from "@/core/di/root-singleton-registry.ts";
import { ngModule } from "@/core/metadata/ng-module.ts";
import { CoreModule, installCoreModule } from "@/runtime/core-module.ts";
import { registerNgModule } from "@/runtime/ng-module-runtime.ts";

/**
 * Descarta los singletons `@Service` / `providedIn: 'root'` cacheados. El
 * `RootSingletonRegistry` es global al proceso, así que sin esto un `@Service`
 * construido en un test anterior (y con `inject(ApplicationRef)` u otra dep de
 * nivel app capturada) sobrevive con una referencia muerta al siguiente
 * bootstrap. Llamarlo entre tests (`beforeEach`), o dejar que
 * `configureTestingModule` lo haga por vos.
 */
export function resetTestingModule(): void {
  RootSingletonRegistry.reset();
}

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
  resetTestingModule();
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
