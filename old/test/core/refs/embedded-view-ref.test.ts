import angular from "angular";
import { describe, expect, it } from "vitest";
import { EmbeddedViewRefImpl } from "@/core/refs/embedded-view-ref.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

describe("etapa 6 — EmbeddedViewRef (contra un $transclude real)", () => {
  it("createEmbeddedView clona el contenido transcluido, ya desconectado de todo parentNode", () => {
    let captured: { $transclude: angular.ITranscludeFunction; $scope: angular.IScope } | undefined;

    const name = uniqueName("embeddedViewTest");
    angular.module(name, []).directive("capture", () => ({
      transclude: true,
      link: (scope: angular.IScope, _el: unknown, _attrs: unknown, _ctrl: unknown, transclude?: angular.ITranscludeFunction) => {
        captured = { $transclude: transclude!, $scope: scope };
      },
    }));

    const host = document.createElement("div");
    host.innerHTML = "<capture><span>hola</span></capture>";
    document.body.appendChild(host);

    angular.bootstrap(host, [name], { strictDi: false });

    expect(captured).toBeDefined();
    const { $transclude, $scope } = captured!;

    const view = new EmbeddedViewRefImpl({ $implicit: "ctx" }, $scope, $transclude);

    expect(view.context).toEqual({ $implicit: "ctx" });
    expect(view.rootNodes.length).toBeGreaterThan(0);
    expect(view.rootNodes.every((node) => node.parentNode === null)).toBe(true);
    expect(view.rootNodes.map((node) => node.textContent).join("")).toContain("hola");
  });

  it("destroy() no explota y marca destroyed, aunque el clon nunca estuvo insertado", () => {
    let captured: { $transclude: angular.ITranscludeFunction; $scope: angular.IScope } | undefined;

    const name = uniqueName("embeddedViewDestroyTest");
    angular.module(name, []).directive("capture", () => ({
      transclude: true,
      link: (scope: angular.IScope, _el: unknown, _attrs: unknown, _ctrl: unknown, transclude?: angular.ITranscludeFunction) => {
        captured = { $transclude: transclude!, $scope: scope };
      },
    }));

    const host = document.createElement("div");
    host.innerHTML = "<capture><span>hola</span></capture>";
    document.body.appendChild(host);
    angular.bootstrap(host, [name], { strictDi: false });

    const view = new EmbeddedViewRefImpl({}, captured!.$scope, captured!.$transclude);

    expect(() => view.destroy()).not.toThrow();
    expect(view.destroyed).toBe(true);
  });
});
