import angular from "angular";
import "angular-mocks";
import { describe, expect, it } from "vitest";
import { Directive } from "@/core/metadata/directive.ts";
import { Input } from "@/core/metadata/input.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { configureTestingModule } from "@/runtime/testing/index.ts";

/**
 * `@Input({ binding: "@" })` → el atributo se toma como string literal /
 * interpolación (`attr="texto"`, `attr="{{ x }}"`), como `@Input()` de Angular
 * usado con `attr="valor"`. `@Input()` a secas sigue siendo `<?` (expresión).
 */
describe('ngjs-core/runtime — @Input({ binding: "@" })', () => {
  it("toma el valor crudo del atributo, incluso con espacios y puntuación", () => {
    const seen: Record<string, unknown> = {};

    @Directive({ selector: "[bm]" })
    class Probe {
      @Input({ binding: "@" }) label: string | undefined;
      @Input({ binding: "@" }) cssClass: string | undefined;
      @Input({ binding: "@", alias: "aliased" }) viaAlias: string | undefined;
      @Input({ binding: "@" }) interpolated: string | undefined;
      @Input() expr: unknown; // `<?` normal, para contraste

      ngOnInit(): void {
        seen.label = this.label;
        seen.cssClass = this.cssClass;
        seen.viaAlias = this.viaAlias;
        seen.interpolated = this.interpolated;
        seen.expr = this.expr;
      }
    }

    @NgModule({ id: "bm.mod", declarations: [Probe] })
    class ProbeModule {}

    angular.mock.module(configureTestingModule({ imports: [ProbeModule] }));
    let $compile!: angular.ICompileService;
    let $rootScope!: angular.IRootScopeService;
    angular.mock.inject((_$compile_: angular.ICompileService, _$rootScope_: angular.IRootScopeService) => {
      $compile = _$compile_;
      $rootScope = _$rootScope_;
    });

    const scope = $rootScope.$new() as angular.IRootScopeService & { name: string; n: number };
    scope.name = "mundo";
    scope.n = 42;
    $compile(
      `<div bm
            label="Great tip!"
            css-class="btn btn-primary"
            aliased="hola"
            interpolated="hola {{ name }}"
            expr="n"></div>`,
    )(scope);
    scope.$digest();

    expect(seen).toEqual({
      label: "Great tip!",
      cssClass: "btn btn-primary",
      viaAlias: "hola",
      interpolated: "hola mundo",
      expr: 42,
    });
  });
});
