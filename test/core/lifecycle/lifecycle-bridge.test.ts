import angular from "angular";
import { describe, expect, it } from "vitest";
import { decorateControllerLifecycle } from "@/runtime/bridges/lifecycle-bridge.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

describe("etapa 5 — controller-bridge: ngOnInit -> $onInit", () => {
  it("llama ngOnInit() a través de $onInit al instanciar un .component() real", () => {
    const name = uniqueName("lifecycleTest");
    const calls: string[] = [];

    angular
      .module(name, [])
      .decorator("$controller", decorateControllerLifecycle)
      .component("widget", {
        template: "ok",
        controller: class {
          ngOnInit() {
            calls.push("ngOnInit");
          }
        },
      });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);

    const injector = angular.bootstrap(host, [name], { strictDi: false });
    injector.get<angular.IRootScopeService>("$rootScope").$digest();

    expect(calls).toEqual(["ngOnInit"]);
  });

  it("una clase sin ngOnInit no explota (no hay nada que reenviar)", () => {
    const name = uniqueName("lifecycleTestSinHook");

    angular
      .module(name, [])
      .decorator("$controller", decorateControllerLifecycle)
      .component("widget", {
        template: "ok",
        controller: class {},
      });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);

    expect(() => {
      const injector = angular.bootstrap(host, [name], { strictDi: false });
      injector.get<angular.IRootScopeService>("$rootScope").$digest();
    }).not.toThrow();
  });

  it("no pisa un $onInit ya declarado a mano (la clase nunca debería escribir $onInit, pero por las dudas)", () => {
    const name = uniqueName("lifecycleTestNoOverride");
    const calls: string[] = [];

    angular
      .module(name, [])
      .decorator("$controller", decorateControllerLifecycle)
      .component("widget", {
        template: "ok",
        controller: class {
          ngOnInit() {
            calls.push("ngOnInit");
          }
          $onInit() {
            calls.push("$onInit-manual");
          }
        },
      });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);

    const injector = angular.bootstrap(host, [name], { strictDi: false });
    injector.get<angular.IRootScopeService>("$rootScope").$digest();

    expect(calls).toEqual(["$onInit-manual"]);
  });

  it("ngOnInit corre una sola vez, no una por decorador re-aplicado", () => {
    const name = uniqueName("lifecycleTestOnce");
    const calls: string[] = [];

    angular
      .module(name, [])
      .decorator("$controller", decorateControllerLifecycle)
      .component("widget", {
        template: "ok",
        controller: class {
          ngOnInit() {
            calls.push("ngOnInit");
          }
        },
      });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget><widget></widget>";
    document.body.appendChild(host);

    const injector = angular.bootstrap(host, [name], { strictDi: false });
    injector.get<angular.IRootScopeService>("$rootScope").$digest();

    expect(calls).toEqual(["ngOnInit", "ngOnInit"]);
  });
});

describe("etapa 5 — controller-bridge: ngOnChanges/ngOnDestroy/ngDoCheck", () => {
  it("ngOnChanges recibe el objeto real de AngularJS, con currentValue/previousValue/isFirstChange()", () => {
    const name = uniqueName("lifecycleTestChanges");
    const changesSeen: unknown[] = [];

    angular
      .module(name, [])
      .decorator("$controller", decorateControllerLifecycle)
      .component("widget", {
        template: "{{ $ctrl.count }}",
        bindings: { count: "<" },
        controller: class {
          ngOnChanges(changes: unknown) {
            changesSeen.push(changes);
          }
        },
      });

    const host = document.createElement("div");
    document.body.appendChild(host);
    const scopeHost = document.createElement("div");
    host.appendChild(scopeHost);
    scopeHost.innerHTML = '<widget count="n"></widget>';

    const injector = angular.bootstrap(host, [name], { strictDi: false });
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");
    ($rootScope as unknown as { n: number }).n = 1;
    $rootScope.$digest();

    ($rootScope as unknown as { n: number }).n = 2;
    $rootScope.$digest();

    // AngularJS puede llamar $onChanges más de una vez por $digest() (el
    // "initial" onChanges del linking, con currentValue undefined porque `n`
    // todavía no existía, corre durante el propio angular.bootstrap() — antes
    // de que el test asigne n=1). No asumimos cantidad ni orden exactos.
    type Changes = { count: { currentValue: number | undefined; previousValue?: number; isFirstChange(): boolean } };
    const seen = changesSeen as Changes[];

    expect(seen.some((c) => c.count.isFirstChange())).toBe(true);

    const changeToOne = seen.find((c) => c.count.currentValue === 1);
    expect(changeToOne).toBeDefined();

    const changeToTwo = seen.find((c) => c.count.currentValue === 2);
    expect(changeToTwo?.count.previousValue).toBe(1);
    expect(changeToTwo?.count.isFirstChange()).toBe(false);
  });

  it("ngOnDestroy corre cuando se destruye el scope del componente", () => {
    const name = uniqueName("lifecycleTestDestroy");
    const calls: string[] = [];

    angular
      .module(name, [])
      .decorator("$controller", decorateControllerLifecycle)
      .component("widget", {
        template: "ok",
        controller: class {
          ngOnDestroy() {
            calls.push("ngOnDestroy");
          }
        },
      });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);

    const injector = angular.bootstrap(host, [name], { strictDi: false });
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");
    $rootScope.$digest();

    expect(calls).toEqual([]);
    $rootScope.$destroy();
    expect(calls).toEqual(["ngOnDestroy"]);
  });

  it("ngDoCheck corre en cada $digest", () => {
    const name = uniqueName("lifecycleTestDoCheck");
    const calls: string[] = [];

    angular
      .module(name, [])
      .decorator("$controller", decorateControllerLifecycle)
      .component("widget", {
        template: "ok",
        controller: class {
          ngDoCheck() {
            calls.push("ngDoCheck");
          }
        },
      });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);

    const injector = angular.bootstrap(host, [name], { strictDi: false });
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");
    $rootScope.$digest();
    const afterFirst = calls.length;
    $rootScope.$digest();

    // $doCheck en AngularJS corre por watcher-check, no una vez por $digest()
    // — el loop de dirty-checking puede iterar varias veces por digest. Solo
    // confirmamos que corrió (al menos una vez) y que el segundo digest
    // agregó más llamadas (sigue corriendo, no se "gastó" después del primero).
    expect(afterFirst).toBeGreaterThanOrEqual(1);
    expect(calls.length).toBeGreaterThan(afterFirst);
  });

  it("ngAfterContentInit y ngAfterViewInit se reenvían al mismo $postLink, content antes que view", () => {
    const name = uniqueName("lifecycleTestPostLink");
    const calls: string[] = [];

    angular
      .module(name, [])
      .decorator("$controller", decorateControllerLifecycle)
      .component("widget", {
        template: "ok",
        controller: class {
          ngAfterViewInit() {
            calls.push("ngAfterViewInit");
          }
          ngAfterContentInit() {
            calls.push("ngAfterContentInit");
          }
        },
      });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);

    const injector = angular.bootstrap(host, [name], { strictDi: false });
    injector.get<angular.IRootScopeService>("$rootScope").$digest();

    expect(calls).toEqual(["ngAfterContentInit", "ngAfterViewInit"]);
  });

  it("con solo ngAfterViewInit (sin ngAfterContentInit) también se reenvía a $postLink", () => {
    const name = uniqueName("lifecycleTestPostLinkOnlyView");
    const calls: string[] = [];

    angular
      .module(name, [])
      .decorator("$controller", decorateControllerLifecycle)
      .component("widget", {
        template: "ok",
        controller: class {
          ngAfterViewInit() {
            calls.push("ngAfterViewInit");
          }
        },
      });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);

    const injector = angular.bootstrap(host, [name], { strictDi: false });
    injector.get<angular.IRootScopeService>("$rootScope").$digest();

    expect(calls).toEqual(["ngAfterViewInit"]);
  });
});
