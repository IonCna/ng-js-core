// El orden importa: los globals se preparan antes de que `angular-mocks` se evalúe y se restauran después.
import "angular";
import "@/testing/angular-mocks-install.ts";
import "angular-mocks";
import "@/testing/angular-mocks-restore.ts";
import angular from "angular";

/** Lo interno de `angular.mock.module` que usa `MockSpec` (lo mismo que usan sus hooks de Jasmine/Mocha). */
interface MockModuleInternals {
  (...modules: unknown[]): unknown;
  $$beforeEach(this: object): void;
  $$cleanup(): void;
  $$currentSpec(spec: object | null): void;
}

/**
 * Un "spec" de `angular.mock` (el objeto donde guarda `$modules`/`$injector`) manejado a mano: `TestBed` abre uno al
 * instanciar su módulo de test y lo cierra en `resetTestingModule()` — así `angular.mock.module`/`inject` corren
 * enseguida, con o sin test runner, y un `resetTestingModule()` a mitad de un test deja crear otro injector.
 */
export class MockSpec {
  private readonly spec: Record<string, unknown> = {};

  static get available(): boolean {
    return typeof angular.mock?.module === "function" && typeof angular.mock?.inject === "function";
  }

  private static get mock(): MockModuleInternals {
    if (!MockSpec.available)
      throw new Error("ngjs-core/testing: angular-mocks no quedó cargado (¿se importó antes que ngjs-core/testing?).");
    return angular.mock.module as unknown as MockModuleInternals;
  }

  /** `angular.mock.module(...modules)` + `angular.mock.inject(...)`: el injector de `ng`, `ngMock` y `modules`. */
  static create(modules: unknown[]): { spec: MockSpec; $injector: angular.auto.IInjectorService } {
    const spec = new MockSpec();
    const mock = MockSpec.mock;
    mock.$$beforeEach.call(spec.spec);
    try {
      mock(...modules);
      let $injector: angular.auto.IInjectorService | undefined;
      angular.mock.inject([
        "$injector",
        (injector: angular.auto.IInjectorService) => {
          $injector = injector;
        },
      ]);
      return { spec, $injector: $injector! };
    } catch (error) {
      spec.close();
      throw error;
    }
  }

  /** `$$cleanup` de `angular-mocks`: destruye el `$rootScope`, limpia `$rootElement` y suelta el injector. */
  close(): void {
    const mock = MockSpec.mock;
    mock.$$currentSpec(this.spec);
    mock.$$cleanup();
  }
}
