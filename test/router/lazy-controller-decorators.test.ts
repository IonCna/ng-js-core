import angular from "angular";
import { describe, expect, it } from "vitest";
import { ConfigProviderFactory } from "@/core/platform/config-providers.ts";
import { decorateControllerLateDecorators } from "@/native/bridges/late-controller-decorators-bridge.ts";
import { LazyNgModuleLoader } from "@/router/lazy-ng-module-loader.ts";

type InjectorWithModules = ConstructorParameters<typeof LazyNgModuleLoader>[0];

describe("LazyNgModuleLoader — .decorator('$controller') de un módulo lazy", () => {
  it("se aplica a los controllers creados después de cargarlo (como el ɵscopedController de una librería)", () => {
    const host = document.createElement("div");
    host.innerHTML = "<eager-cmp></eager-cmp>";
    document.body.appendChild(host);
    // Lo que trae `NativeModule` para esto: el punto de extensión y la captura de providers que usa el loader.
    angular
      .module("lazyDecoratorsApp", [])
      .decorator("$controller", decorateControllerLateDecorators)
      .config(ConfigProviderFactory.capture)
      .component("eagerCmp", { template: "eager", controller: class {} });
    const $injector = angular.bootstrap(host, ["lazyDecoratorsApp"], { strictDi: false });

    // El módulo lazy: registra un componente y un decorador de `$controller` que le da un `local` a su constructor.
    const seen: string[] = [];
    angular
      .module("lazyDecoratorsFeature", [])
      .decorator("$controller", [
        "$delegate",
        ($delegate: Function) =>
          (expression: unknown, locals: Record<string, unknown> | undefined, ...rest: unknown[]) => {
            seen.push("decorated");
            return $delegate(expression, { ...locals, greeting: "hola" }, ...rest);
          },
      ])
      .component("lazyCmp", {
        template: "{{ $ctrl.greeting }}",
        controller: [
          "greeting",
          function (this: { greeting: string }, greeting: string) {
            this.greeting = greeting;
          },
        ],
      });
    new LazyNgModuleLoader($injector as InjectorWithModules).load(Object.assign(class {}, { ɵmod: { id: "lazyDecoratorsFeature" } }));

    const $rootScope = $injector.get<angular.IRootScopeService>("$rootScope");
    const element = $injector.get<angular.ICompileService>("$compile")("<lazy-cmp></lazy-cmp>")($rootScope);
    $rootScope.$digest();

    expect(element.text()).toBe("hola");
    expect(seen.length).toBeGreaterThan(0);
    host.remove();
  });
});
