import angular from "angular";
import { describe, expect, it } from "vitest";
import { NgTemplateOutlet } from "@/runtime/common/ng-template-outlet.ts";
import { decorateNgRefDirective } from "@/runtime/bridges/ng-ref-bridge.ts";
import { TemplateRef } from "@/core/refs/template-ref.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

function bootOutlet(html: string): { host: HTMLElement; $rootScope: angular.IRootScopeService } {
  const name = uniqueName("ngTemplateOutletTest");
  angular
    .module(name, [])
    .decorator("ngRefDirective", decorateNgRefDirective)
    .directive("ngTemplate", TemplateRef.$factory)
    .directive("ngTemplateOutlet", NgTemplateOutlet.$factory);

  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  const injector = angular.bootstrap(host, [name], { strictDi: false });
  return { host, $rootScope: injector.get<angular.IRootScopeService>("$rootScope") };
}

describe("etapa 8 — *ngTemplateOutlet", () => {
  it("renderiza el template bindeado, insertado después del propio elemento del outlet", () => {
    const { host, $rootScope } = bootOutlet(
      '<ng-template ng-ref="tpl" ng-ref-read="ngTemplate" let-item="$implicit"><span>{{item}}</span></ng-template>' +
        '<div id="outlet" ng-template-outlet="tpl" ng-template-outlet-context="{$implicit: \'hola\'}"></div>',
    );
    $rootScope.$digest();

    const outlet = host.querySelector("#outlet") as Element;
    expect(outlet.nextElementSibling?.tagName).toBe("SPAN");
    expect(outlet.nextElementSibling?.textContent).toBe("hola");
  });

  it("cambiar el template bindeado destruye la vista anterior e inserta la nueva", () => {
    const { host, $rootScope } = bootOutlet(
      '<ng-template ng-ref="tplA" ng-ref-read="ngTemplate"><span class="a">A</span></ng-template>' +
        '<ng-template ng-ref="tplB" ng-ref-read="ngTemplate"><span class="b">B</span></ng-template>' +
        '<div id="outlet" ng-template-outlet="current"></div>',
    );
    const $scope = $rootScope as unknown as { tplA?: TemplateRef; tplB?: TemplateRef; current?: TemplateRef };
    $scope.current = $scope.tplA;
    $rootScope.$digest();

    expect(host.querySelector(".a")).not.toBeNull();
    expect(host.querySelector(".b")).toBeNull();

    $scope.current = $scope.tplB;
    $rootScope.$digest();

    expect(host.querySelector(".a")).toBeNull();
    expect(host.querySelector(".b")).not.toBeNull();
  });

  it("sin template bindeado, no inserta nada", () => {
    const { host } = bootOutlet('<div id="outlet" ng-template-outlet="ninguno"></div>');

    const outlet = host.querySelector("#outlet") as Element;
    expect(outlet.nextElementSibling).toBeNull();
  });

  it("$onDestroy limpia la vista embebida insertada", () => {
    const { host, $rootScope } = bootOutlet(
      '<ng-template ng-ref="tpl" ng-ref-read="ngTemplate"><span>hola</span></ng-template>' +
        '<div ng-if="show" id="outlet" ng-template-outlet="tpl"></div>',
    );
    const $scope = $rootScope as unknown as { show: boolean; tpl?: TemplateRef };
    $scope.show = true;
    $rootScope.$digest();

    expect(host.querySelector("span")).not.toBeNull();

    $scope.show = false;
    $rootScope.$digest();

    expect(host.querySelector("span")).toBeNull();
  });
});
