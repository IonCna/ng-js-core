import angular from "angular";
import "angular-mocks";
import { describe, expect, it } from "vitest";
import { Directive } from "@/core/metadata/directive.ts";
import { Input } from "@/core/metadata/input.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { configureTestingModule } from "@/runtime/testing/index.ts";

/**
 * Escenario de las specs de `ngb-js`: una `@Directive` de atributo con `@Input`
 * y `ngOnInit`, compilada suelta con `$compile('<div ...>')` (no dentro de un
 * `@Component` bootstrappeado). Debe disparar `ngOnInit` y bindear el `@Input`,
 * como Angular real.
 */
describe("@Directive ad-hoc: ngOnInit + @Input via $compile", () => {
  function compileInModule(module: string): {
    $compile: angular.ICompileService;
    $rootScope: angular.IRootScopeService;
  } {
    angular.mock.module(module);
    let $compile!: angular.ICompileService;
    let $rootScope!: angular.IRootScopeService;
    angular.mock.inject((_$compile_: angular.ICompileService, _$rootScope_: angular.IRootScopeService) => {
      $compile = _$compile_;
      $rootScope = _$rootScope_;
    });
    return { $compile, $rootScope };
  }

  it("dispara ngOnInit y bindea el @Input (@NgModule sin controllerAs)", () => {
    const calls: string[] = [];

    @Directive({ selector: "[probeA]" })
    class ProbeA {
      @Input() probeValue = "DEFAULT";
      ngOnInit(): void {
        calls.push(`ngOnInit:${this.probeValue}`);
      }
    }

    @NgModule({ id: "probe.adhoc.a", declarations: [ProbeA] })
    class ProbeModuleA {}

    const { $compile, $rootScope } = compileInModule(configureTestingModule({ imports: [ProbeModuleA] }));
    const scope = $rootScope.$new();
    const element = $compile(`<div probe-a probe-value="'BOUND'"></div>`)(scope);
    scope.$digest();

    expect(calls).toEqual(["ngOnInit:BOUND"]);
    expect((element.controller("probeA") as ProbeA).probeValue).toBe("BOUND");
  });

  it("bindea el @Input cuando el @NgModule aporta controllerAs", () => {
    const calls: string[] = [];

    @Directive({ selector: "[probeB]" })
    class ProbeB {
      @Input() probeValue = "DEFAULT";
      ngOnInit(): void {
        calls.push(`ngOnInit:${this.probeValue}`);
      }
    }

    @NgModule({ id: "probe.adhoc.b", controllerAs: "$", declarations: [ProbeB] })
    class ProbeModuleB {}

    const { $compile, $rootScope } = compileInModule(configureTestingModule({ imports: [ProbeModuleB] }));
    const scope = $rootScope.$new();
    const element = $compile(`<div probe-b probe-value="'BOUND'"></div>`)(scope);
    scope.$digest();

    expect(calls).toEqual(["ngOnInit:BOUND"]);
    expect((element.controller("probeB") as ProbeB).probeValue).toBe("BOUND");
  });
});
