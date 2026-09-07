import "reflect-metadata";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { inject } from "@/core/di/inject.ts";
import { Injectable } from "@/core/di/injectable.ts";
import { Injector, InjectorImpl } from "@/core/di/injector.ts";
import { Service } from "@/core/di/service.ts";
import { decorateControllerInjectionContext } from "@/runtime/bridges/injection-context-bridge.ts";
import { decorateControllerScopedInjector } from "@/runtime/bridges/scoped-injector-bridge.ts";
import { component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { registerNgModule } from "@/runtime/ng-module-runtime.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

function bootInjector(name: string) {
  const module = angular.module(name, []);
  module.service(Injector.$name, InjectorImpl);
  return angular.injector(["ng", name]).get<Injector>(Injector.$name);
}

describe("@Service — singleton implícito de app", () => {
  it("Injector.get() lo resuelve sin que esté listado en ningún providers", () => {
    @Service()
    class Clock {
      now = Date.now();
    }

    const injector = bootInjector(uniqueName("serviceInjectorTest"));
    expect(injector.get(Clock)).toBeInstanceOf(Clock);
  });

  it("es un singleton: la misma instancia en cada resolución", () => {
    @Service()
    class Counter {
      value = 0;
    }

    const injector = bootInjector(uniqueName("serviceSingletonTest"));
    const a = injector.get(Counter);
    a.value = 42;

    expect(injector.get(Counter)).toBe(a);
    expect(injector.get(Counter).value).toBe(42);
  });

  it("un @Service puede pedir otro @Service con inject() en un field initializer", () => {
    @Service()
    class Config {
      apiUrl = "https://example.test";
    }

    @Service()
    class Api {
      config = inject(Config);
    }

    const injector = bootInjector(uniqueName("serviceNestedTest"));
    expect(injector.get(Api).config).toBeInstanceOf(Config);
    expect(injector.get(Api).config.apiUrl).toBe("https://example.test");
  });

  it("constructor con parámetros: tira al decorar, no llega a runtime", () => {
    expect(() => {
      @Service()
      class Broken {
        constructor(_x: unknown) {}
      }
      void Broken;
    }).toThrow(/no admite DI por constructor/);
  });

  it("inject() dentro de un componente SIN providers propios resuelve un @Service (camino sin nodo jerárquico)", () => {
    @Service()
    class Greeter {
      greet(): string {
        return "hola";
      }
    }

    @Injectable()
    class Widget {
      greeter = inject(Greeter);
    }

    const name = uniqueName("serviceNoNodeTest");
    angular
      .module(name, [])
      .decorator("$controller", decorateControllerInjectionContext)
      .component("widget", { template: "ok", controller: Widget });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);
    angular.bootstrap(host, [name], { strictDi: false });

    const ctrl = angular.element(host.querySelector("widget") as Element).controller("widget") as Widget;
    expect(ctrl.greeter.greet()).toBe("hola");
  });

  it("inject() dentro de un componente CON providers propios igual resuelve un @Service (camino con nodo jerárquico, vía fromAppInjector)", () => {
    @Injectable()
    class Local {
      static readonly $name = "ServiceTestLocal";
    }

    @Service()
    class Greeter {
      greet(): string {
        return "hola";
      }
    }

    @Injectable()
    class Widget {
      local = inject(Local);
      greeter = inject(Greeter);
    }
    component(Widget).define({ selector: "widget", providers: [Local] });

    const name = uniqueName("serviceWithNodeTest");
    angular
      .module(name, [])
      .decorator("$controller", decorateControllerInjectionContext)
      .decorator("$controller", decorateControllerScopedInjector)
      .component("widget", { template: "ok", controller: Widget });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);
    angular.bootstrap(host, [name], { strictDi: false });

    const ctrl = angular.element(host.querySelector("widget") as Element).controller("widget") as Widget;
    expect(ctrl.greeter.greet()).toBe("hola");
  });

  it("listar un @Service en @NgModule({ providers }) tira un error claro", () => {
    @Service()
    class Oops {}

    @NgModule({ id: uniqueName("serviceInNgModuleProviders"), providers: [Oops] })
    class AppModule {}

    expect(() => registerNgModule(AppModule)).toThrow(/ya es un singleton implícito/);
  });

  it("listar un @Service en @Component({ providers }) tira un error claro al resolverlo", () => {
    @Service()
    class Oops {}

    @Injectable()
    class Widget {
      oops = inject(Oops);
    }
    component(Widget).define({ selector: "widget", providers: [Oops] });

    const name = uniqueName("serviceInComponentProviders");
    const seenErrors: unknown[] = [];
    angular
      .module(name, [])
      .decorator("$controller", decorateControllerInjectionContext)
      .decorator("$controller", decorateControllerScopedInjector)
      .component("widget", { template: "ok", controller: Widget })
      // AngularJS no deja escapar el error de linking hacia afuera de
      // angular.bootstrap() — lo atrapa y lo manda a $exceptionHandler.
      .decorator("$exceptionHandler", [
        "$delegate",
        (_$delegate: (error: unknown) => void) =>
          (error: unknown) => {
            seenErrors.push(error);
          },
      ]);

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);
    angular.bootstrap(host, [name], { strictDi: false });

    expect(seenErrors).toHaveLength(1);
    expect(String(seenErrors[0])).toMatch(/ya es un singleton implícito/);
  });
});
