import angular from "angular";
import { describe, expect, it } from "vitest";
import { ElementRefImpl } from "@/core/refs/element-ref.ts";
import { TemplateRef } from "@/core/refs/template-ref.ts";
import { ViewContainerRefImpl } from "@/core/refs/view-container-ref.ts";
import { ViewRefImpl } from "@/core/refs/view-ref.ts";

let templateCounter = 0;
function uniqueTemplateModuleName(prefix: string): string {
  templateCounter++;
  return `${prefix}${templateCounter}`;
}

function bootTemplateRef(html: string): { templateRef: TemplateRef; $rootScope: angular.IRootScopeService } {
  const captured: TemplateRef[] = [];
  const name = uniqueTemplateModuleName("vcrEmbeddedViewTest");
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
  return { templateRef: captured[0], $rootScope: injector.get<angular.IRootScopeService>("$rootScope") };
}

function freshScope(): angular.IScope {
  const injector = angular.injector(["ng"]);
  return injector.get<angular.IRootScopeService>("$rootScope").$new();
}

function makeView(text: string): ViewRefImpl {
  const node = document.createElement("span");
  node.textContent = text;
  return new ViewRefImpl(freshScope(), [node]);
}

function makeContainer(): { vcr: ViewContainerRefImpl; parent: HTMLElement; anchor: HTMLElement } {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const anchor = document.createElement("div");
  anchor.setAttribute("data-anchor", "");
  parent.appendChild(anchor);

  const vcr = new ViewContainerRefImpl(new ElementRefImpl(anchor), {} as angular.auto.IInjectorService);
  return { vcr, parent, anchor };
}

function textOf(parent: HTMLElement): string[] {
  return Array.from(parent.querySelectorAll("span")).map((el) => el.textContent ?? "");
}

describe("etapa 6 — ViewContainerRef (DOM real, sin createComponent)", () => {
  it("insert() agrega vistas en el DOM, en orden, después del anchor", () => {
    const { vcr, parent } = makeContainer();

    vcr.insert(makeView("a"));
    vcr.insert(makeView("b"));

    expect(vcr.length).toBe(2);
    expect(textOf(parent)).toEqual(["a", "b"]);
  });

  it("insert(view, index) inserta en una posición específica", () => {
    const { vcr, parent } = makeContainer();

    vcr.insert(makeView("a"));
    vcr.insert(makeView("c"));
    vcr.insert(makeView("b"), 1);

    expect(textOf(parent)).toEqual(["a", "b", "c"]);
  });

  it("get()/indexOf() reflejan el orden actual", () => {
    const { vcr } = makeContainer();
    const a = makeView("a");
    const b = makeView("b");

    vcr.insert(a);
    vcr.insert(b);

    expect(vcr.get(0)).toBe(a);
    expect(vcr.get(1)).toBe(b);
    expect(vcr.get(2)).toBeNull();
    expect(vcr.indexOf(b)).toBe(1);
    expect(vcr.indexOf(makeView("x"))).toBe(-1);
  });

  it("detach() saca la vista del DOM y del container, pero NO la destruye", () => {
    const { vcr, parent } = makeContainer();
    const a = makeView("a");
    vcr.insert(a);

    const detached = vcr.detach(0);

    expect(detached).toBe(a);
    expect(a.destroyed).toBe(false);
    expect(textOf(parent)).toEqual([]);
    expect(vcr.length).toBe(0);
    expect(vcr.indexOf(a)).toBe(-1);
  });

  it("remove() detach + destroy", () => {
    const { vcr, parent } = makeContainer();
    const a = makeView("a");
    vcr.insert(a);

    vcr.remove(0);

    expect(a.destroyed).toBe(true);
    expect(textOf(parent)).toEqual([]);
  });

  it("move() reordena una vista ya insertada", () => {
    const { vcr, parent } = makeContainer();
    const a = makeView("a");
    const b = makeView("b");
    vcr.insert(a);
    vcr.insert(b);

    vcr.move(b, 0);

    expect(textOf(parent)).toEqual(["b", "a"]);
  });

  it("move() sobre una vista que no pertenece al container lanza", () => {
    const { vcr } = makeContainer();
    expect(() => vcr.move(makeView("x"), 0)).toThrow(/no pertenece/);
  });

  it("clear() detach+destroy de todas las vistas", () => {
    const { vcr, parent } = makeContainer();
    vcr.insert(makeView("a"));
    vcr.insert(makeView("b"));

    vcr.clear();

    expect(vcr.length).toBe(0);
    expect(textOf(parent)).toEqual([]);
  });

  it("insertar una vista ya destruida lanza", () => {
    const { vcr } = makeContainer();
    const a = makeView("a");
    a.destroy();

    expect(() => vcr.insert(a)).toThrow(/destruida/);
  });

  it("insertar una vista que ya pertenece a otro container la saca del primero", () => {
    const { vcr: first, parent: firstParent } = makeContainer();
    const { vcr: second, parent: secondParent } = makeContainer();
    const a = makeView("a");

    first.insert(a);
    second.insert(a);

    expect(first.length).toBe(0);
    expect(second.length).toBe(1);
    expect(textOf(firstParent)).toEqual([]);
    expect(textOf(secondParent)).toEqual(["a"]);
  });

  it("destruir una vista directamente (sin pasar por remove()) la saca sola del container", () => {
    const { vcr } = makeContainer();
    const a = makeView("a");
    const b = makeView("b");
    vcr.insert(a);
    vcr.insert(b);

    a.destroy();

    expect(vcr.length).toBe(1);
    expect(vcr.get(0)).toBe(b);
  });
});

describe("etapa 8 — ViewContainerRef.createEmbeddedView (con un TemplateRef real)", () => {
  it("crea la vista embebida, la inserta en el DOM, y queda dentro de la lista del container", () => {
    const { templateRef, $rootScope } = bootTemplateRef(
      '<ng-template capture-template-ref let-item="$implicit"><span>{{item}}</span></ng-template>',
    );
    const { vcr, parent } = makeContainer();

    const viewRef = vcr.createEmbeddedView(templateRef, { $implicit: "hola" });
    $rootScope.$digest();

    expect(vcr.length).toBe(1);
    expect(vcr.get(0)).toBe(viewRef);
    expect(textOf(parent)).toContain("hola");
  });

  it("acepta index como número o como { index }, igual que insert()", () => {
    const { templateRef, $rootScope } = bootTemplateRef(
      '<ng-template capture-template-ref let-item="$implicit"><span>{{item}}</span></ng-template>',
    );
    const { vcr, parent } = makeContainer();

    vcr.insert(makeView("a"));
    vcr.insert(makeView("c"));
    vcr.createEmbeddedView(templateRef, { $implicit: "b" }, 1);
    $rootScope.$digest();

    expect(textOf(parent)).toEqual(["a", "b", "c"]);
  });

  it("remove()/destroy() de la vista embebida saca sus rootNodes del DOM", () => {
    const { templateRef, $rootScope } = bootTemplateRef(
      '<ng-template capture-template-ref let-item="$implicit"><span>{{item}}</span></ng-template>',
    );
    const { vcr, parent } = makeContainer();

    vcr.createEmbeddedView(templateRef, { $implicit: "hola" });
    $rootScope.$digest();
    expect(textOf(parent)).toEqual(["hola"]);

    vcr.remove(0);
    expect(textOf(parent)).toEqual([]);
    expect(vcr.length).toBe(0);
  });
});
