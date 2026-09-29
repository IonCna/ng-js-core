import angular from "angular";
import { describe, expect, it } from "vitest";
import { OutputAttributes } from "@/core/platform/output-attributes.ts";

describe("OutputAttributes", () => {
  it("names: solo los bindings `&`, con su alias en kebab-case", () => {
    expect(OutputAttributes.names({ header: "@?", count: "<?", hidden: "&?", shown: "&?afterShown" })).toEqual([
      "hidden",
      "after-shown",
    ]);
    expect(OutputAttributes.directive({ header: "@?" }, "E")).toBeUndefined();
  });

  it("saca del DOM el atributo del output después de leer el binding (un `hidden` no oculta el host)", () => {
    const bindings = { hidden: "&?" };
    let instance: { hidden?: () => void } | undefined;
    const outputs = OutputAttributes.directive(bindings, "E")!;
    angular
      .module("outputAttributesTest", [])
      .component("appToast", {
        bindings,
        controller: function (this: { hidden?: () => void }) {
          instance = this;
        },
      })
      .directive("appToast", outputs);

    const host = document.createElement("div");
    host.innerHTML = `<app-toast ng-if="visible" hidden="onHidden()"></app-toast>`;
    document.body.appendChild(host);
    const $rootScope = angular
      .bootstrap(host, ["outputAttributesTest"], { strictDi: false })
      .get<angular.IRootScopeService & { visible?: boolean; onHidden?: () => void }>("$rootScope");
    let hiddenCount = 0;
    $rootScope.onHidden = () => hiddenCount++;

    $rootScope.visible = true;
    $rootScope.$digest();
    const toast = host.querySelector("app-toast")!;
    expect(toast.hasAttribute("hidden")).toBe(false);

    instance!.hidden!();
    expect(hiddenCount).toBe(1);

    // `ng-if` clona el template compilado: el atributo sigue ahí y el output funciona en cada instancia.
    $rootScope.visible = false;
    $rootScope.$digest();
    $rootScope.visible = true;
    $rootScope.$digest();
    expect(host.querySelector("app-toast")!.hasAttribute("hidden")).toBe(false);
    instance!.hidden!();
    expect(hiddenCount).toBe(2);
    host.remove();
  });
});
