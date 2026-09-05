import angular, { type IExceptionHandlerService } from "angular";
import { Injector, InjectorImpl } from "@/core/di/injector";
import { AfterRenderEventManager } from "@/core/lifecycle/after-render-event-manager";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { ApplicationRef, ApplicationRefImpl } from "@/core/platform/application-ref";
import { ConfigProviderFactory, type IAnimateProvider } from "@/core/platform/config-providers";
import { ErrorHandler, ErrorHandlerImpl } from "@/core/platform/error-handler";
import { NgZone } from "@/core/platform/ng-zone";
import { EventEmitter } from "@/event-emitter";
import { decorateControllerAsyncPipe } from "@/runtime/bridges/async-pipe-bridge.ts";
import { decorateControllerAttributes } from "@/runtime/bridges/attribute-bridge.ts";
import { decorateControllerChangeDetectorRef } from "@/runtime/bridges/change-detector-ref-bridge.ts";
import { decorateControllerDestroyRef } from "@/runtime/bridges/destroy-ref-bridge.ts";
import { decorateControllerElementRef } from "@/runtime/bridges/element-ref-bridge.ts";
import { decorateControllerHostBindings } from "@/runtime/bridges/host-binding-bridge.ts";
import { decorateControllerHostListeners } from "@/runtime/bridges/host-listener-bridge.ts";
import { decorateControllerLifecycle } from "@/runtime/bridges/lifecycle-bridge.ts";
import { decorateNgDisabledDirective } from "@/runtime/bridges/ng-disabled-bridge.ts";
import { decorateControllerViewChildQueries, decorateNgRefDirective } from "@/runtime/bridges/ng-ref-bridge.ts";
import { decorateControllerScopedInjector } from "@/runtime/bridges/scoped-injector-bridge.ts";
import { decorateControllerViewContainerRef } from "@/runtime/bridges/view-container-ref-bridge.ts";
import { registerNgModule } from "@/runtime/ng-module-runtime.ts";

/**
 * `CoreModule` (`ng.js.core`) — el `@NgModule` base del runtime. Declara los
 * servicios de app (`ApplicationRef`, `ErrorHandler`, `Injector`,
 * `AfterRenderEventManager`) de forma declarativa; todo lo que AngularJS solo
 * deja hacer imperativamente (`.decorator()` sobre `$controller`/`$exceptionHandler`,
 * `.config()`, `.run()`) se encadena una sola vez abajo, sobre el `angular.module`
 * real. Es la ÚNICA definición de core — no hay un segundo módulo paralelo.
 */
@NgModule({
  id: "ng.js.core",
  providers: [
    { provide: ApplicationRef, useClass: ApplicationRefImpl },
    { provide: ErrorHandler, useClass: ErrorHandlerImpl },
    { provide: Injector, useClass: InjectorImpl },
    AfterRenderEventManager,
  ],
})
export class CoreModule {}

let coreInstalled = false;

/**
 * Registra `CoreModule` como `angular.module` y le engancha (una sola vez) todo
 * lo imperativo que AngularJS no deja declarar: los `.decorator()` sobre
 * `$controller`/`$exceptionHandler`, la captura de config-providers, el `.run()`
 * que fuerza `Injector`, y el `.factory("NgZone")` que lee de `BootstrapZone`.
 *
 * `ApplicationRef` (cable Zone→$digest) y el listener de `ngZone.onError` NO se
 * enganchan acá: dependen de una `NgZone` real y `CoreModule` tiene que poder
 * cargarse en un test unitario con zona fake. Los cablea `PlatformRef` al
 * bootstrappear (ver `platform/bootstrap.ts`).
 */
export function installCoreModule(): angular.IModule {
  const coreModule = registerNgModule(CoreModule);
  if (coreInstalled) return coreModule;
  coreInstalled = true;

  coreModule
    // Bridges de ciclo de vida / refs / queries — decoran `$controller` al instanciar
    // cada controller. Orden significativo: `scopedInjector` primero, `lifecycle` último.
    .decorator("$controller", decorateControllerScopedInjector)
    .decorator("$controller", decorateControllerElementRef)
    .decorator("$controller", decorateControllerAttributes)
    .decorator("$controller", decorateControllerChangeDetectorRef)
    .decorator("$controller", decorateControllerViewContainerRef)
    .decorator("$controller", decorateControllerViewChildQueries)
    .decorator("$controller", decorateControllerAsyncPipe)
    .decorator("$controller", decorateControllerDestroyRef)
    .decorator("$controller", decorateControllerHostListeners)
    .decorator("$controller", decorateControllerHostBindings)
    .decorator("$controller", decorateControllerLifecycle)
    .decorator("ngDisabledDirective", decorateNgDisabledDirective)
    .decorator("ngRefDirective", decorateNgRefDirective)
    .decorator("$exceptionHandler", decorateExceptionHandler())
    .config(catchConfigProviders())
    .run(forceInjector())
    .factory(NgZone.$name, provideBootstrapZone());

  return coreModule;
}

/**
 * Portador de la `NgZone` del bootstrap en curso. La `NgZone` la crea el
 * `PlatformRef` (una por bootstrap) pero `CoreModule` es estático; en vez de
 * re-registrar una `.constant()` por bootstrap (que se acumularían en el invoke
 * queue del módulo compartido y chocarían), el factory de `NgZone` — registrado
 * UNA vez arriba — lee de acá, y `configureCore` swapea el valor antes de cada
 * `angular.bootstrap`. Mismo patrón que `InjectorImpl.current` / `ConfigProviderFactory.current`.
 */
class BootstrapZone {
  static current?: NgZone;
}

/**
 * `NgZone` mínima sin `zone.js`: `run`/`runOutsideAngular`/`runGuarded` ejecutan
 * el callback tal cual y los emisores nunca disparan. Es el fallback para cuando
 * no hubo `configureCore` (tests con `angular.mock.module`, `createComponent`
 * suelto): el controller puede pedir `NgZone` en su ctor sin que el test tenga
 * que stubbearla, y sin cargar `zone.js` en un entorno de test que no lo espera.
 * Con bootstrap real `PlatformRef` provee la `NgZone` de verdad vía `configureCore`.
 */
function createInertNgZone(): NgZone {
  const passthrough = <T>(fn: () => T): T => fn();
  return {
    onUnstable: new EventEmitter<void>(),
    onMicrotaskEmpty: new EventEmitter<void>(),
    onStable: new EventEmitter<void>(),
    onError: new EventEmitter<unknown>(),
    isStable: true,
    hasPendingMicrotasks: false,
    hasPendingMacrotasks: false,
    run: passthrough,
    runGuarded: passthrough,
    runTask: passthrough,
    runOutsideAngular: passthrough,
  } as unknown as NgZone;
}

function provideBootstrapZone() {
  const factory = () => {
    BootstrapZone.current ??= createInertNgZone();
    return BootstrapZone.current;
  };
  factory.$inject = [] as string[];
  return factory;
}

/**
 * Prepara `ng.js.core` para un bootstrap: fija la `NgZone` de esta app y devuelve
 * el nombre del módulo. Lo llama `PlatformRef` antes de `angular.bootstrap`.
 */
export function configureCore(ngZone: NgZone): string {
  const coreModule = installCoreModule();
  BootstrapZone.current = ngZone;
  return coreModule.name;
}

function decorateExceptionHandler() {
  const decorator = ($delegate: IExceptionHandlerService, errorHandler: ErrorHandler): IExceptionHandlerService => {
    return (exception: Error, cause?: string) => {
      errorHandler.handleError(exception);
      $delegate(exception, cause);
    };
  };
  decorator.$inject = ["$delegate", ErrorHandler.$name];
  return decorator;
}

function catchConfigProviders() {
  const config = (
    $compileProvider: angular.ICompileProvider,
    $controllerProvider: angular.IControllerProvider,
    $provide: angular.auto.IProvideService,
    $filterProvider: angular.IFilterProvider,
    $animateProvider: IAnimateProvider,
  ) => {
    ConfigProviderFactory.from({
      $compile: $compileProvider,
      $controller: $controllerProvider,
      $provide: $provide,
      $filter: $filterProvider,
      $animate: $animateProvider,
    });
  };
  config.$inject = ["$compileProvider", "$controllerProvider", "$provide", "$filterProvider", "$animateProvider"];
  return config;
}

function forceInjector() {
  // `Injector` es lazy (`.service()`) y `InjectorImpl.current` es un singleton global
  // por proceso: sin forzarlo acá, con más de una app bootstrappeada `.current` queda
  // apuntando al `$injector` de la última que lo haya pedido. Instanciarlo en el `.run()`
  // garantiza que `.current` sea el de la app recién bootstrappeada.
  const run = (_: Injector) => angular.noop();
  run.$inject = [Injector.$name];
  return run;
}
