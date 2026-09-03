import type { ICompileService, IRootScopeService } from "angular";
import angular from "angular";
import { beforeEach, describe, expect, it } from "vitest";

describe("harness (etapa 0)", () => {
  let $compile: ICompileService;
  let $rootScope: IRootScopeService;

  beforeEach(() => {
    angular.module("harnessTest", []).component("hello", {
      template: "hola {{ $ctrl.n }}",
      controllerAs: "$ctrl",
      controller: class {
        n = 1;
      },
    });

    angular.mock.module("harnessTest");
    angular.mock.inject((_$compile_: ICompileService, _$rootScope_: IRootScopeService) => {
      $compile = _$compile_;
      $rootScope = _$rootScope_;
    });
  });

  it("compila un componente AngularJS y corre el digest", () => {
    const element = $compile("<hello></hello>")($rootScope);
    $rootScope.$digest();

    expect(element.text().trim()).toBe("hola 1");
  });

  it("reflect-metadata está instalado", () => {
    expect(typeof Reflect.getMetadata).toBe("function");
  });
});
