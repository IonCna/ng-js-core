import "reflect-metadata";
import "zone.js";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { bootstrap, component } from "@/compat/index.ts";

describe("ngjs-core/compat — registro en vivo tras el bootstrap", () => {
  it("component().define() después del bootstrap se registra con los config-providers capturados", async () => {
    class Shell {
      static readonly $inject: string[] = [];
    }
    component(Shell).define({ selector: "compat-live-shell", template: "shell" });

    const host = document.createElement("compat-live-shell");
    document.body.appendChild(host);
    const appRef = await bootstrap(host);

    class Late {
      static readonly $inject: string[] = [];
    }
    component(Late).define({ selector: "compat-late", controllerAs: "$", template: "<u>tarde</u>" });

    const injector = angular.element(host).injector() as angular.auto.IInjectorService;
    const $compile = injector.get<angular.ICompileService>("$compile");
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");
    const el = $compile("<compat-late></compat-late>")($rootScope.$new() as angular.IScope);
    $rootScope.$digest();

    expect((el[0] as HTMLElement).textContent).toContain("tarde");
    appRef.destroy();
  });
});
