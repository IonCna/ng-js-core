import angular from "angular";
import { describe, expect, it } from "vitest";
import { decorateNgDisabledDirective, NgDisabledController, NgDisabledImpl } from "@/runtime/bridges/ng-disabled-bridge.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

describe("etapa 9 — NgDisabledImpl (unidad, sin AngularJS)", () => {
  it("notifica solo en cambios distintos, y deja de notificar tras cortar la suscripción", () => {
    const disabled = new NgDisabledImpl();
    const changes: boolean[] = [];
    const stop = disabled.onChange((value) => changes.push(value));

    disabled.setDisabled(true);
    disabled.setDisabled(true); // mismo valor: no vuelve a notificar
    stop();
    disabled.setDisabled(false); // ya cortado: no llega

    expect(changes).toEqual([true]);
    expect(disabled.disabled).toBe(false);
  });
});

describe("etapa 9 — ng-disabled decorado contra AngularJS real", () => {
  it("no reemplaza el comportamiento nativo: sigue seteando/sacando el atributo disabled", () => {
    const name = uniqueName("ngDisabledTest");
    angular.module(name, []).decorator("ngDisabledDirective", decorateNgDisabledDirective);

    const host = document.createElement("div");
    host.innerHTML = '<button ng-disabled="isDisabled"></button>';
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [name], { strictDi: false });
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope") as angular.IRootScopeService & {
      isDisabled: boolean;
    };

    const button = host.querySelector("button") as HTMLButtonElement;
    expect(button.hasAttribute("disabled")).toBe(false);

    $rootScope.isDisabled = true;
    $rootScope.$digest();

    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("otra directiva co-ubicada (require: '?ngDisabled') se entera de los cambios sin reimplementar el watch", () => {
    const seen: boolean[] = [];
    const name = uniqueName("ngDisabledTest");
    angular
      .module(name, [])
      .decorator("ngDisabledDirective", decorateNgDisabledDirective)
      .directive("watchDisabled", () => ({
        require: "?ngDisabled",
        link: (_scope: angular.IScope, _el: unknown, _attrs: unknown, ctrl?: NgDisabledController) => {
          ctrl?.onChange((value) => seen.push(value));
        },
      }));

    const host = document.createElement("div");
    host.innerHTML = '<button ng-disabled="isDisabled" watch-disabled></button>';
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [name], { strictDi: false });
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope") as angular.IRootScopeService & {
      isDisabled: boolean;
    };

    $rootScope.isDisabled = true;
    $rootScope.$digest();
    $rootScope.isDisabled = false;
    $rootScope.$digest();

    expect(seen).toEqual([true, false]);
  });

  it("el estado inicial ya queda resuelto tras el propio digest de angular.bootstrap(), sin necesitar un $digest() extra del test", () => {
    const captured: NgDisabledController[] = [];
    const name = uniqueName("ngDisabledTest");
    angular
      .module(name, [])
      .decorator("ngDisabledDirective", decorateNgDisabledDirective)
      .directive("watchDisabled", () => ({
        require: "?ngDisabled",
        link: (_scope: angular.IScope, _el: unknown, _attrs: unknown, ctrl?: NgDisabledController) => {
          if (ctrl) captured.push(ctrl);
        },
      }))
      // $rootScope.isDisabled ya está en true ANTES del primer compile+digest
      // (fase .run(), no hace falta un $digest() extra desde el test).
      .run([
        "$rootScope",
        ($rootScope: angular.IRootScopeService & { isDisabled: boolean }) => {
          $rootScope.isDisabled = true;
        },
      ]);

    const host = document.createElement("div");
    host.innerHTML = '<button ng-disabled="isDisabled" watch-disabled></button>';
    document.body.appendChild(host);
    angular.bootstrap(host, [name], { strictDi: false });

    expect(captured[0]?.disabled).toBe(true);
    expect((host.querySelector("button") as HTMLButtonElement).disabled).toBe(true);
  });
});
