import angular from "angular";
import "angular-mocks";
import { describe, expect, it } from "vitest";
import { EventEmitter } from "@/event-emitter.ts";
import { Directive } from "@/core/metadata/directive.ts";
import { Input } from "@/core/metadata/input.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { Output } from "@/core/metadata/output.ts";
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

  it("dispara ngOnInit aunque la directiva tenga un @Output (regresión)", () => {
    // `output-emitter-bridge` deja un `$onInit` puesto antes de `lifecycle-bridge`;
    // el forwarding de `ngOnInit` no debe perderse por eso. Casi toda directiva de
    // ng-bootstrap combina `@Output` + `ngOnInit`.
    const calls: string[] = [];

    @Directive({ selector: "[probeC]" })
    class ProbeC {
      @Input() probeValue = "DEFAULT";
      @Output() probeChange = new EventEmitter<string>();
      ngOnInit(): void {
        calls.push(`ngOnInit:${this.probeValue}`);
        this.probeChange.emit(this.probeValue);
      }
    }

    @NgModule({ id: "probe.adhoc.c", declarations: [ProbeC] })
    class ProbeModuleC {}

    const emitted: string[] = [];
    const { $compile, $rootScope } = compileInModule(configureTestingModule({ imports: [ProbeModuleC] }));
    const scope = $rootScope.$new() as angular.IRootScopeService & { onChange: (v: string) => void };
    scope.onChange = (v) => emitted.push(v);
    $compile(`<div probe-c probe-value="'BOUND'" probe-change="onChange($event)"></div>`)(scope);
    scope.$digest();

    expect(calls).toEqual(["ngOnInit:BOUND"]);
    expect(emitted).toEqual(["BOUND"]);
  });
});
