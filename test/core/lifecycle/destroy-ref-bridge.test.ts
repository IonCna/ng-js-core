import angular from "angular";
import { describe, expect, it } from "vitest";
import { decorateControllerDestroyRef } from "@/core/lifecycle/destroy-ref-bridge.ts";
import { DestroyRef } from "@/rxjs-interop/destroy-ref.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

describe("etapa 12 — DestroyRef wiring contra $controller real", () => {
  it("inyecta un DestroyRef por-instancia que corre al destruirse el $scope real", () => {
    const name = uniqueName("destroyRefBridgeTest");
    let called = false;
    angular.module(name, []).decorator("$controller", decorateControllerDestroyRef).component("widget", {
      template: "ok",
      controller: class {
        static $inject = [DestroyRef.$name];
        constructor(destroyRef: DestroyRef) {
          destroyRef.onDestroy(() => {
            called = true;
          });
        }
      },
    });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);
    angular.bootstrap(host, [name], { strictDi: false });

    const widgetEl = host.querySelector("widget") as Element;
    (angular.element(widgetEl).isolateScope() as angular.IScope).$destroy();

    expect(called).toBe(true);
  });

  it("dos instancias del mismo componente reciben cada una su propio DestroyRef", () => {
    const name = uniqueName("destroyRefBridgeTestTwo");
    angular.module(name, []).decorator("$controller", decorateControllerDestroyRef).component("widget", {
      template: "ok",
      controller: class {
        static $inject = [DestroyRef.$name];
        destroyRef: DestroyRef;
        constructor(destroyRef: DestroyRef) {
          this.destroyRef = destroyRef;
        }
      },
    });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget><widget></widget>";
    document.body.appendChild(host);
    angular.bootstrap(host, [name], { strictDi: false });

    const [first, second] = Array.from(host.querySelectorAll("widget"));
    const ctrl1 = angular.element(first).controller("widget") as { destroyRef: DestroyRef };
    const ctrl2 = angular.element(second).controller("widget") as { destroyRef: DestroyRef };

    expect(ctrl1.destroyRef).not.toBe(ctrl2.destroyRef);
  });
});
