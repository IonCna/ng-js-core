import "zone.js";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { provideAppInitializer } from "@/core/platform/app-initializer";
import { ApplicationRef } from "@/core/platform/application-ref";
import { bootstrapApplication, PlatformRefImpl, platformBrowser } from "@/core/platform/bootstrap";
import { ConfigProviderFactory } from "@/core/platform/config-providers";
import { ErrorHandler } from "@/core/platform/error-handler";
import { NgZone } from "@/core/platform/ng-zone";

let moduleCounter = 0;
function uniqueModuleName(prefix: string): string {
  moduleCounter++;
  return `${prefix}${moduleCounter}`;
}

function mountHost(tag = "div"): HTMLElement {
  const host = document.createElement(tag);
  document.body.appendChild(host);
  return host;
}

describe("etapa 2 — bootstrap y aplicación", () => {
  it("bootstrappea un angular.module a mano y resuelve un ApplicationRef", async () => {
    const host = mountHost("root-widget"); // el host es el propio elemento raíz a compilar
    const name = uniqueModuleName("bootstrapTestApp");
    angular.module(name, []).component("rootWidget", {
      template: "hola {{ $ctrl.name }}",
      controller: class {
        name = "mundo";
      },
    });

    const platform = new PlatformRefImpl();
    const appRef = await platform.bootstrapModule(name, { hostElement: host });

    expect(appRef).toBeInstanceOf(ApplicationRef);
    expect(host.textContent?.trim()).toBe("hola mundo");

    platform.destroy();
  });

  it("whenStable resuelve una vez que la app queda quieta", async () => {
    const host = mountHost();
    const name = uniqueModuleName("bootstrapTestStable");
    angular.module(name, []);

    const platform = new PlatformRefImpl();
    const appRef = await platform.bootstrapModule(name, { hostElement: host });

    await expect(appRef.whenStable()).resolves.toBeUndefined();

    platform.destroy();
  });

  it("APP_INITIALIZER corre y se espera antes de dar la app por lista", async () => {
    const host = mountHost();
    const name = uniqueModuleName("bootstrapTestInit");
    const order: string[] = [];

    provideAppInitializer(async () => {
      order.push("initializer-start");
      await Promise.resolve();
      await Promise.resolve();
      order.push("initializer-end");
    });

    angular.module(name, []);

    const platform = new PlatformRefImpl();
    await platform.bootstrapModule(name, { hostElement: host });
    order.push("bootstrap-resuelto");

    expect(order).toEqual(["initializer-start", "initializer-end", "bootstrap-resuelto"]);

    platform.destroy();
  });

  it("registra un componente después del bootstrap usando los providers capturados", async () => {
    const host = mountHost();
    const name = uniqueModuleName("bootstrapTestLazy");
    angular.module(name, []);

    const platform = new PlatformRefImpl();
    await platform.bootstrapModule(name, { hostElement: host });

    // simula el chunk lazy: nada lo registró en tiempo de config,
    // se registra recién ahora usando el $compileProvider capturado.
    const captured = ConfigProviderFactory.current;
    expect(captured).toBeDefined();
    captured?.$compile.component("lazyWidget", { template: "chunk cargado" });

    const lazyHost = document.createElement("lazy-widget");
    host.appendChild(lazyHost);

    const $injector = angular.element(host).injector();
    const $compile = $injector.get<angular.ICompileService>("$compile");
    const $rootScope = $injector.get<angular.IRootScopeService>("$rootScope");
    $compile(lazyHost)($rootScope);
    $rootScope.$digest();

    expect(lazyHost.textContent?.trim()).toBe("chunk cargado");

    platform.destroy();
  });

  it("el decorador de $exceptionHandler reenvía errores síncronos al ErrorHandler", async () => {
    const host = mountHost();
    const name = uniqueModuleName("bootstrapTestSyncError");
    angular.module(name, []);

    const platform = new PlatformRefImpl();
    await platform.bootstrapModule(name, { hostElement: host });

    const $injector = angular.element(host).injector();
    const errorHandler = $injector.get<ErrorHandler>(ErrorHandler.$name);
    const seen: unknown[] = [];
    errorHandler.handleError = (error) => seen.push(error);

    const $exceptionHandler = $injector.get<(error: unknown) => void>("$exceptionHandler");
    const boom = new Error("boom síncrono");
    $exceptionHandler(boom);

    expect(seen).toEqual([boom]);

    platform.destroy();
  });

  it("los errores que escapan de la zona llegan al ErrorHandler", async () => {
    const host = mountHost();
    const name = uniqueModuleName("bootstrapTestZoneError");
    angular.module(name, []);

    const platform = new PlatformRefImpl();
    await platform.bootstrapModule(name, { hostElement: host });

    const $injector = angular.element(host).injector();
    const errorHandler = $injector.get<ErrorHandler>(ErrorHandler.$name);
    const ngZone = $injector.get<NgZone>(NgZone.$name);
    const seen: unknown[] = [];
    errorHandler.handleError = (error) => seen.push(error);

    const boom = new Error("boom de zona");
    ngZone.runGuarded(() => {
      throw boom;
    });

    expect(seen).toEqual([boom]);

    platform.destroy();
  });

  it("destroy() destruye las apps registradas y notifica a los listeners", async () => {
    const host = mountHost();
    const name = uniqueModuleName("bootstrapTestDestroy");
    angular.module(name, []);

    const platform = new PlatformRefImpl();
    const appRef = await platform.bootstrapModule(name, { hostElement: host });

    let notified = false;
    platform.onDestroy(() => {
      notified = true;
    });

    platform.destroy();

    expect(platform.destroyed).toBe(true);
    expect(appRef.destroyed).toBe(true);
    expect(notified).toBe(true);
    await expect(platform.bootstrapModule(name, { hostElement: host })).rejects.toThrow("PlatformRef ya fue destruido");
  });

  it("bootstrapApplication monta el componente raíz creando el host si falta", async () => {
    const name = uniqueModuleName("bootstrapAppRoot");
    angular.module(name, []).component("appRoot", {
      template: "app lista",
    });

    const appRef = await bootstrapApplication("appRoot", { modules: [name] });

    const host = document.querySelector("app-root");
    expect(host?.textContent?.trim()).toBe("app lista");
    expect(platformBrowser()).toBeDefined();

    appRef.destroy();
  });
});
