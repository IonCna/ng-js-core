import angular from "angular";
import { describe, expect, it } from "vitest";
import { getDirectiveDef } from "@/core/metadata/directive.ts";
import { TemplateRef } from "@/core/refs/template-ref.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

function bootWithTemplate(html: string): { host: HTMLElement; $rootScope: angular.IRootScopeService; captured: TemplateRef[] } {
  const captured: TemplateRef[] = [];
  const name = uniqueName("templateRefTest");
  angular
    .module(name, [])
    .directive("ngTemplate", TemplateRef.$factory)
    .directive("captureTemplateRef", () => ({
      require: "ngTemplate",
      link: (_scope: angular.IScope, _el: unknown, _attrs: unknown, ctrl?: TemplateRef) => {
        if (ctrl) captured.push(ctrl);
      },
    }));

  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);

  const injector = angular.bootstrap(host, [name], { strictDi: false });
  return { host, $rootScope: injector.get<angular.IRootScopeService>("$rootScope"), captured };
}

describe("etapa 8 — TemplateRef / <ng-template>", () => {
  it("@Directive estampa metadata (selector) — no registra nada por su cuenta", () => {
    const def = getDirectiveDef(TemplateRef);
    expect(def?.selector).toBe("ng-template");
  });

  it("createEmbeddedView clona el contenido, desconectado, listo para insertarse a mano", () => {
    const { captured } = bootWithTemplate("<ng-template capture-template-ref><span>hola</span></ng-template>");
    const [templateRef] = captured;

    const view = templateRef.createEmbeddedView({});

    expect(view.rootNodes.length).toBeGreaterThan(0);
    expect(view.rootNodes.every((node) => node.parentNode === null)).toBe(true);
    expect(view.rootNodes.map((node) => node.textContent).join("")).toContain("hola");
  });

  it("let-item resuelve contra el contexto pasado a createEmbeddedView ($implicit por default)", () => {
    const { $rootScope, captured } = bootWithTemplate(
      '<ng-template capture-template-ref let-item="$implicit"><span>{{item}}</span></ng-template>',
    );
    const [templateRef] = captured;

    const view = templateRef.createEmbeddedView({ $implicit: "valor-implicito" });
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    for (const node of view.rootNodes) mount.appendChild(node);
    $rootScope.$digest();

    expect(mount.textContent).toContain("valor-implicito");
  });

  it("let-x='clave' resuelve contra una clave con nombre del contexto, no solo $implicit", () => {
    const { $rootScope, captured } = bootWithTemplate(
      '<ng-template capture-template-ref let-nombre="userName"><span>{{nombre}}</span></ng-template>',
    );
    const [templateRef] = captured;

    const view = templateRef.createEmbeddedView({ userName: "maxi" });
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    for (const node of view.rootNodes) mount.appendChild(node);
    $rootScope.$digest();

    expect(mount.textContent).toContain("maxi");
  });

  it("cada createEmbeddedView() arma una vista/scope propio, independiente de las demás", () => {
    const { $rootScope, captured } = bootWithTemplate(
      '<ng-template capture-template-ref let-item="$implicit"><span>{{item}}</span></ng-template>',
    );
    const [templateRef] = captured;

    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const viewA = templateRef.createEmbeddedView({ $implicit: "a" });
    const viewB = templateRef.createEmbeddedView({ $implicit: "b" });
    for (const node of [...viewA.rootNodes, ...viewB.rootNodes]) mount.appendChild(node);
    $rootScope.$digest();

    expect(mount.querySelectorAll("span")[0].textContent).toBe("a");
    expect(mount.querySelectorAll("span")[1].textContent).toBe("b");

    viewA.destroy();
    expect(mount.querySelectorAll("span")).toHaveLength(1);
    expect(mount.textContent).toBe("b");
  });
});
