import angular from "angular";
import "angular-mocks";
import { describe, expect, it } from "vitest";
import { Directive } from "@/core/metadata/directive.ts";
import { Input } from "@/core/metadata/input.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { commonModule } from "@/runtime/common/index.ts";
import { registerNgModule } from "@/runtime/ng-module-runtime.ts";
import { configureTestingModule } from "@/runtime/testing/index.ts";

/**
 * Reproduce el grafo a-medio-migrar de `ngb-js`: un `@NgModule` raíz (con
 * `controllerAs`) que importa por NOMBRE un `angular.module()` crudo (estilo
 * legacy de `ngb-js`), y por CLASE un `@NgModule` que declara una `@Directive`
 * con `ngOnInit`. La directiva de clase debe seguir recibiendo su `ngOnInit`.
 */
describe("grafo mixto (@NgModule + angular.module crudo): forwarding de lifecycle", () => {
  it("ngOnInit dispara para una @Directive declarada en un @NgModule anidado", () => {
    const calls: string[] = [];

    // --- rama "vieja": angular.module() crudo, como los *.module.ts sin migrar ---
    const legacyModule = angular.module("legacy.mixed.mod", [commonModule().name]);
    legacyModule.directive("legacyNoop", () => ({ restrict: "A" }));

    // --- rama "nueva": @Directive de clase en un @NgModule ---
    @Directive({ selector: "[mixedDir]" })
    class MixedDir {
      @Input() mixedValue = "DEFAULT";
      ngOnInit(): void {
        calls.push(`init:${this.mixedValue}`);
      }
    }

    @NgModule({ id: "mixed.leaf", declarations: [MixedDir] })
    class LeafModule {}

    @NgModule({
      id: "mixed.root",
      controllerAs: "$",
      imports: [LeafModule, legacyModule.name],
    })
    class RootModule {}

    const rootMod = registerNgModule(RootModule);
    angular.mock.module(configureTestingModule({ imports: [rootMod] }));

    let $compile!: angular.ICompileService;
    let $rootScope!: angular.IRootScopeService;
    angular.mock.inject((_$compile_: angular.ICompileService, _$rootScope_: angular.IRootScopeService) => {
      $compile = _$compile_;
      $rootScope = _$rootScope_;
    });

    const scope = $rootScope.$new();
    const element = $compile(`<div mixed-dir mixed-value="'BOUND'"></div>`)(scope);
    scope.$digest();

    expect(calls).toEqual(["init:BOUND"]);
    expect((element.controller("mixedDir") as MixedDir).mixedValue).toBe("BOUND");
  });
});
