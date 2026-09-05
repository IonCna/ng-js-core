import "zone.js";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { InjectionToken } from "@/core/di/injection-token.ts";
import type { Provider } from "@/core/di/provider.ts";
import { bootstrapApplication } from "@/core/platform/bootstrap.ts";

let counter = 0;
function uniqueComponentName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

async function boot(providers: Provider[]) {
  const componentName = uniqueComponentName("providerRoot");
  angular.module(`m-${componentName}`, []).component(componentName, { template: "ok" });

  const appRef = await bootstrapApplication(componentName, {
    modules: [`m-${componentName}`],
    providers,
  });

  const tag = componentName.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  const $injector = angular.element(document.querySelector(tag) as Element).injector();
  return { appRef, $injector };
}

describe("etapa 3 — registro de providers en bootstrapApplication", () => {
  it("useValue registra un valor directo", async () => {
    const API_URL = new InjectionToken<string>("API_URL");
    const { appRef, $injector } = await boot([{ provide: API_URL, useValue: "https://example.test" }]);

    expect($injector.get(API_URL.toString())).toBe("https://example.test");
    appRef.destroy();
  });

  it("useClass registra una clase resuelta por AngularJS (con sus propias deps)", async () => {
    class Logger {
      static readonly $name = "Logger";
      static $inject = ["$rootScope"];
      constructor(public rootScope: angular.IRootScopeService) {}
    }
    const { appRef, $injector } = await boot([{ provide: Logger, useClass: Logger }]);

    const logger = $injector.get<Logger>("Logger");
    expect(logger).toBeInstanceOf(Logger);
    expect(logger.rootScope).toBe($injector.get("$rootScope"));
    appRef.destroy();
  });

  it("useClass sustituye la implementación: provide y useClass son clases distintas", async () => {
    abstract class Logger {
      static readonly $name = "Logger";
      abstract log(msg: string): string;
    }
    class FileLogger extends Logger {
      log(msg: string) {
        return `file: ${msg}`;
      }
    }
    const { appRef, $injector } = await boot([{ provide: Logger, useClass: FileLogger }]);

    const logger = $injector.get<Logger>("Logger");
    expect(logger).toBeInstanceOf(FileLogger);
    expect(logger.log("hola")).toBe("file: hola");
    appRef.destroy();
  });

  it("providers anidados (array dentro de array) se aplanan", async () => {
    const A = new InjectionToken<string>("A");
    const B = new InjectionToken<string>("B");
    const { appRef, $injector } = await boot([{ provide: A, useValue: "a" }, [{ provide: B, useValue: "b" }]]);

    expect($injector.get(A.toString())).toBe("a");
    expect($injector.get(B.toString())).toBe("b");
    appRef.destroy();
  });

  it("multi: true funciona mezclando useClass con useValue en el mismo grupo", async () => {
    const HANDLERS = new InjectionToken<unknown>("HANDLERS");
    class HandlerA {
      static readonly $name = "HandlerA";
    }
    const { appRef, $injector } = await boot([
      { provide: HANDLERS, useClass: HandlerA, multi: true },
      { provide: HANDLERS, useValue: "handler-b", multi: true },
    ]);

    const handlers = $injector.get<unknown[]>(HANDLERS.toString());
    expect(handlers[0]).toBeInstanceOf(HandlerA);
    expect(handlers[1]).toBe("handler-b");
    appRef.destroy();
  });

  it("una clase pelada (TypeProvider) se registra bajo su propio $name", async () => {
    class Clock {
      static readonly $name = "Clock";
    }
    const { appRef, $injector } = await boot([Clock]);

    expect($injector.get("Clock")).toBeInstanceOf(Clock);
    appRef.destroy();
  });

  it("useFactory resuelve deps y las pasa posicionalmente", async () => {
    const APP_CONFIG = new InjectionToken<{ url: string }>("APP_CONFIG");
    const { appRef, $injector } = await boot([
      {
        provide: APP_CONFIG,
        useFactory: ($rootScope: angular.IRootScopeService) => ({ url: "from-factory", hasScope: !!$rootScope }),
        deps: ["$rootScope"],
      },
    ]);

    expect($injector.get(APP_CONFIG.toString())).toEqual({ url: "from-factory", hasScope: true });
    appRef.destroy();
  });

  it("useExisting resuelve al mismo objeto que el token original", async () => {
    const ORIGINAL = new InjectionToken<{ id: number }>("ORIGINAL");
    const ALIAS = new InjectionToken<{ id: number }>("ALIAS");
    const { appRef, $injector } = await boot([
      { provide: ORIGINAL, useValue: { id: 1 } },
      { provide: ALIAS, useExisting: ORIGINAL },
    ]);

    expect($injector.get(ALIAS.toString())).toBe($injector.get(ORIGINAL.toString()));
    appRef.destroy();
  });

  it("un provider sin objeto (ConstructorProvider) usa `deps` para su $inject", async () => {
    class Reporter {
      static readonly $name = "Reporter";
      constructor(public rootScope: angular.IRootScopeService) {}
    }
    const { appRef, $injector } = await boot([{ provide: Reporter, deps: ["$rootScope"] }]);

    const reporter = $injector.get<Reporter>("Reporter");
    expect(reporter).toBeInstanceOf(Reporter);
    expect(reporter.rootScope).toBe($injector.get("$rootScope"));
    appRef.destroy();
  });

  it("multi: true junta todos los providers del token en un array", async () => {
    const PLUGINS = new InjectionToken<string>("PLUGINS");
    const { appRef, $injector } = await boot([
      { provide: PLUGINS, useValue: "uno", multi: true },
      { provide: PLUGINS, useValue: "dos", multi: true },
      { provide: PLUGINS, useFactory: () => "tres", multi: true },
    ]);

    expect($injector.get(PLUGINS.toString())).toEqual(["uno", "dos", "tres"]);
    appRef.destroy();
  });

  it("sin multi, el último provider para el mismo token gana", async () => {
    const FLAG = new InjectionToken<string>("FLAG");
    const { appRef, $injector } = await boot([
      { provide: FLAG, useValue: "primero" },
      { provide: FLAG, useValue: "segundo" },
    ]);

    expect($injector.get(FLAG.toString())).toBe("segundo");
    appRef.destroy();
  });
});
