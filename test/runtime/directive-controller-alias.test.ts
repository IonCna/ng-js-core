import angular from "angular";
import "angular-mocks";
import { describe, expect, it } from "vitest";
import { Component } from "@/core/metadata/component.ts";
import { Directive } from "@/core/metadata/directive.ts";
import { buildDirectiveDefinition } from "@/core/metadata/directive-definition.ts";
import { Input } from "@/core/metadata/input.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { configureTestingModule } from "@/runtime/testing/index.ts";

describe("directive controller aliases", () => {
  it("preserves the parent alias and passes its exported reference to an outlet", () => {
    @Directive({ selector: "[aliasNav]", exportAs: "aliasNav" })
    class Nav {}

    @Directive({ selector: "[aliasLink]" })
    class Link {}

    let seen: unknown;
    @Component({ selector: "[aliasOutlet]", template: "" })
    class Outlet {
      @Input("aliasOutlet") nav: unknown;
      ngAfterViewInit(): void {
        seen = this.nav;
      }
    }

    @NgModule({ id: "alias.regression", controllerAs: "$", declarations: [Nav, Link, Outlet] })
    class Feature {}

    angular.mock.module(configureTestingModule({ imports: [Feature] }));
    angular.mock.inject(($compile: angular.ICompileService, $rootScope: angular.IRootScopeService) => {
      const parent: { nav?: Nav } = {};
      const scope = $rootScope.$new() as angular.IScope & { $: typeof parent };
      scope.$ = parent;
      const element = $compile(`
        <div>
          <ul alias-nav ng-ref="$.nav" ng-ref-read="aliasNav">
            <li><button alias-link>Tab</button></li>
          </ul>
          <div alias-outlet="$.nav"></div>
        </div>
      `)(scope);
      try {
        scope.$digest();
        expect(scope.$).toBe(parent);
        expect(parent.nav).toBeInstanceOf(Nav);
        expect(seen).toBe(parent.nav);
      } finally {
        scope.$destroy();
        element.remove();
      }
    });
  });

  it("preserves explicit aliases and module aliases for directives with templates", () => {
    class Probe {}
    const def = { selector: "[aliasProbe]", inputs: [], outputs: [] };
    expect(buildDirectiveDefinition(Probe, { ...def, controllerAs: "own" }, "$").controllerAs).toBe("own");
    expect(buildDirectiveDefinition(Probe, { ...def, template: "<span></span>" }, "$").controllerAs).toBe("$");
    expect(buildDirectiveDefinition(Probe, { ...def, templateUrl: "probe.html" }, "$").controllerAs).toBe("$");
  });
});
