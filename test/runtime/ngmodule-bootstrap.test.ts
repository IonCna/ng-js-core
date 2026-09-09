import "reflect-metadata";
import "zone.js";
import { afterEach, describe, expect, it } from "vitest";
import { Component } from "@/core/metadata/component.ts";
import { Directive } from "@/core/metadata/directive.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootstrapApplication } from "@/runtime/index.ts";

let appRef: { destroy(): void } | undefined;

/** Contenedor fresco por test — AngularJS no deja bootstrapear dos veces el mismo elemento. */
function container(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  appRef?.destroy();
  appRef = undefined;
  document.body.innerHTML = "";
});

describe("ngjs-core/runtime — @NgModule({ bootstrap })", () => {
  it("crea el elemento del componente raíz dentro del host y lo compila", async () => {
    @Component({ selector: "nb-root", controllerAs: "$", template: "<span>raíz {{ $.n }}</span>" })
    class NbRoot {
      n = 1;
    }

    @NgModule({ imports: [CommonModule], declarations: [NbRoot], bootstrap: [NbRoot] })
    class AppModule {}

    const host = container();
    appRef = await bootstrapApplication(AppModule, { hostElement: host });

    const el = host.querySelector("nb-root");
    expect(el).not.toBeNull();
    expect(el?.textContent).toContain("raíz 1");
  });

  it("no duplica el elemento si ya está en el DOM", async () => {
    @Component({ selector: "nb-existing", controllerAs: "$", template: "<u>x</u>" })
    class NbExisting {}

    @NgModule({ imports: [CommonModule], declarations: [NbExisting], bootstrap: [NbExisting] })
    class AppModule {}

    const host = container();
    host.appendChild(document.createElement("nb-existing"));

    appRef = await bootstrapApplication(AppModule, { hostElement: host });

    expect(host.querySelectorAll("nb-existing")).toHaveLength(1);
    expect(host.querySelector("nb-existing u")?.textContent).toBe("x");
  });

  it("monta varios componentes raíz", async () => {
    @Component({ selector: "nb-a", controllerAs: "$", template: "<span>A</span>" })
    class NbA {}
    @Component({ selector: "nb-b", controllerAs: "$", template: "<span>B</span>" })
    class NbB {}

    @NgModule({ imports: [CommonModule], declarations: [NbA, NbB], bootstrap: [NbA, NbB] })
    class AppModule {}

    const host = container();
    appRef = await bootstrapApplication(AppModule, { hostElement: host });

    expect(host.querySelector("nb-a")?.textContent).toBe("A");
    expect(host.querySelector("nb-b")?.textContent).toBe("B");
  });

  it("acepta el selector escrito en camelCase (mismo tag de elemento)", async () => {
    @Component({ selector: "nbKebabCamel", controllerAs: "$", template: "<span>k</span>" })
    class NbKebabCamel {}

    @NgModule({ imports: [CommonModule], declarations: [NbKebabCamel], bootstrap: [NbKebabCamel] })
    class AppModule {}

    const host = container();
    appRef = await bootstrapApplication(AppModule, { hostElement: host });

    expect(host.querySelector("nb-kebab-camel")?.textContent).toBe("k");
  });

  it("`bootstrap` de un @NgModule importado se ignora (fiel a Angular)", async () => {
    @Component({ selector: "cb-child-root", controllerAs: "$", template: "<span>CHILD</span>" })
    class ChildRoot {}
    @Component({ selector: "cb-root", controllerAs: "$", template: "<span>ROOT</span>" })
    class RootComp {}

    @NgModule({ imports: [CommonModule], declarations: [ChildRoot], bootstrap: [ChildRoot] })
    class ChildModule {}

    @NgModule({ imports: [ChildModule], declarations: [RootComp], bootstrap: [RootComp] })
    class RootModule {}

    const host = container();
    appRef = await bootstrapApplication(RootModule, { hostElement: host });

    expect(host.querySelector("cb-root")?.textContent).toBe("ROOT");
    expect(host.querySelector("cb-child-root")).toBeNull();
  });

  it("lanza si un `bootstrap` no es @Component", async () => {
    class NotAComponent {}

    @NgModule({ imports: [CommonModule], bootstrap: [NotAComponent] })
    class AppModule {}

    await expect(bootstrapApplication(AppModule)).rejects.toThrow(/no es un @Component/);
  });

  it("lanza si el `bootstrap` no está en `declarations` (como Angular)", async () => {
    @Component({ selector: "nb-undeclared", controllerAs: "$", template: "x" })
    class NbUndeclared {}

    @NgModule({ imports: [CommonModule], bootstrap: [NbUndeclared] }) // falta en declarations
    class AppModule {}

    await expect(bootstrapApplication(AppModule)).rejects.toThrow(/tiene que estar en 'declarations'/);
  });

  it("lanza si el selector del `bootstrap` es de atributo", async () => {
    @Component({ selector: "[nbAttrCmp]", controllerAs: "$", template: "x" })
    class NbAttrCmp {}
    @Directive({ selector: "[nbAttr]" })
    class NbAttrDir {}

    @NgModule({ imports: [CommonModule], declarations: [NbAttrCmp], bootstrap: [NbAttrCmp] })
    class AttrCmpModule {}
    @NgModule({ imports: [CommonModule], declarations: [NbAttrDir], bootstrap: [NbAttrDir] })
    class AttrDirModule {}

    await expect(bootstrapApplication(AttrCmpModule)).rejects.toThrow(/selector de elemento/);
    await expect(bootstrapApplication(AttrDirModule)).rejects.toThrow(/no es un @Component/);
  });

  it("sin `bootstrap` el comportamiento no cambia (host se compila tal cual)", async () => {
    @Component({ selector: "nb-plain", controllerAs: "$", template: "<span>plain</span>" })
    class NbPlain {}

    @NgModule({ imports: [CommonModule], declarations: [NbPlain] })
    class AppModule {}

    const host = document.createElement("nb-plain");
    document.body.appendChild(host);

    appRef = await bootstrapApplication(AppModule, { hostElement: host });

    expect(host.querySelector("span")?.textContent).toBe("plain");
  });
});
