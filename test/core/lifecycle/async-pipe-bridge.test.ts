import angular from "angular";
import { Subject } from "rxjs";
import { describe, expect, it } from "vitest";
import { decorateControllerAsyncPipe } from "@/core/lifecycle/async-pipe-bridge.ts";
import { AsyncPipe, AsyncPipeImpl } from "@/pipes/async-pipe.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

describe("etapa 11 — AsyncPipe wiring contra $controller real", () => {
  it("inyecta un AsyncPipe por-instancia, y $ctrl.async.transform(value$) refleja emisiones en el template", () => {
    const name = uniqueName("asyncPipeBridgeTest");
    angular.module(name, []).decorator("$controller", decorateControllerAsyncPipe).component("widget", {
      template: "{{ $ctrl.async.transform($ctrl.value$) }}",
      controller: class {
        static $inject = [AsyncPipe.$name];
        value$ = new Subject<string>();
        async: AsyncPipe;
        constructor(async: AsyncPipe) {
          this.async = async;
        }
      },
    });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);

    const injector = angular.bootstrap(host, [name], { strictDi: false });
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");

    const widgetEl = host.querySelector("widget") as Element;
    const ctrl = angular.element(widgetEl).controller("widget") as { value$: Subject<string> };

    ctrl.value$.next("hola");
    $rootScope.$digest();

    expect(widgetEl.textContent?.trim()).toBe("hola");
  });

  it("dos instancias del mismo componente reciben cada una su propio AsyncPipe", () => {
    const name = uniqueName("asyncPipeBridgeTestTwo");
    angular.module(name, []).decorator("$controller", decorateControllerAsyncPipe).component("widget", {
      template: "ok",
      controller: class {
        static $inject = [AsyncPipe.$name];
        async: AsyncPipe;
        constructor(async: AsyncPipe) {
          this.async = async;
        }
      },
    });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget><widget></widget>";
    document.body.appendChild(host);
    angular.bootstrap(host, [name], { strictDi: false });

    const [first, second] = Array.from(host.querySelectorAll("widget"));
    const ctrl1 = angular.element(first).controller("widget") as { async: AsyncPipe };
    const ctrl2 = angular.element(second).controller("widget") as { async: AsyncPipe };

    expect(ctrl1.async).not.toBe(ctrl2.async);
  });

  it("al destruirse el $scope del componente, su AsyncPipe se desuscribe solo", () => {
    const name = uniqueName("asyncPipeBridgeDestroyTest");
    angular.module(name, []).decorator("$controller", decorateControllerAsyncPipe).component("widget", {
      template: "ok",
      controller: class {
        static $inject = [AsyncPipe.$name];
        async: AsyncPipeImpl;
        constructor(async: AsyncPipe) {
          this.async = async as AsyncPipeImpl;
        }
      },
    });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);
    angular.bootstrap(host, [name], { strictDi: false });

    const widgetEl = host.querySelector("widget") as Element;
    const ctrl = angular.element(widgetEl).controller("widget") as { async: AsyncPipeImpl };
    const subject = new Subject<number>();

    ctrl.async.transform(subject);
    expect(subject.observed).toBe(true);

    (angular.element(widgetEl).isolateScope() as angular.IScope | undefined)?.$destroy();

    expect(subject.observed).toBe(false);
  });
});
