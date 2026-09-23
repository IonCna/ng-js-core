import angular from "angular";
import "angular-mocks";
import { describe, expect, it } from "vitest";
import { forwardRef } from "@/core/di/forward-ref.ts";
import { ContentChild } from "@/core/queries/content-child.ts";
import { ContentChildren } from "@/core/queries/content-children.ts";
import type { QueryList } from "@/core/queries/query-list.ts";
import { Directive } from "@/core/metadata/directive.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { configureTestingModule } from "@/runtime/testing/index.ts";

/**
 * `@ContentChild(forwardRef(() => X))` / `@ContentChildren(forwardRef(() => X))` —
 * el `forwardRef` se desenvuelve al CONSTRUIR la query (no al decorar), así una
 * referencia circular entre archivos (`A` decora con una clase de `B`, y `B`
 * importa `A`) no rompe el query.
 *
 * Se pasa el `forwardRef` de forma que reproduce el bug real: el valor `X` es
 * `undefined` en el momento del decorado y solo existe después.
 */
describe("ngjs-core/queries — forwardRef en el locator", () => {
  it("resuelve un locator envuelto en forwardRef sobre light DOM", () => {
    // `LATE` arranca sin valor: simula la clase que en el import circular
    // todavía no se evaluó cuando corre el decorador de abajo.
    const box: { LATE?: Function } = {};

    @Directive({ selector: "[fwHost]" })
    class FwHost {
      @ContentChildren(forwardRef(() => box.LATE as Function))
      items!: QueryList<unknown>;

      @ContentChild(forwardRef(() => box.LATE as Function))
      first!: unknown;
    }

    @Directive({ selector: "[fwItem]" })
    class FwItem {
      tag = "item";
    }
    box.LATE = FwItem;

    @NgModule({ id: "fw.mod", declarations: [FwHost, FwItem] })
    class FwModule {}

    angular.mock.module(configureTestingModule({ imports: [FwModule] }));
    let $compile!: angular.ICompileService;
    let $rootScope!: angular.IRootScopeService;
    angular.mock.inject((_$compile_: angular.ICompileService, _$rootScope_: angular.IRootScopeService) => {
      $compile = _$compile_;
      $rootScope = _$rootScope_;
    });

    const el = $compile("<div fw-host><span fw-item></span><span fw-item></span></div>")($rootScope.$new());
    $rootScope.$digest();

    const ctrl = el.controller("fwHost") as FwHost;
    expect(ctrl.items.length).toBe(2);
    expect(ctrl.first).toBeInstanceOf(FwItem);
  });
});
