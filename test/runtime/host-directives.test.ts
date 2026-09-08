import angular from "angular";
import "angular-mocks";
import { describe, expect, it } from "vitest";
import { Directive } from "@/core/metadata/directive.ts";
import { HostBinding } from "@/core/metadata/host-binding.ts";
import { HostListener } from "@/core/metadata/host-listener.ts";
import { inject } from "@/core/di/inject.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { configureTestingModule } from "@/runtime/testing/index.ts";

describe("ngjs-core/runtime — hostDirectives", () => {
  it("instancia la directiva compuesta sobre el mismo elemento, la cablea y la deja inject()-able", () => {
    const log: string[] = [];

    @Directive({ selector: "[hdChild]" })
    class HdChild {
      clicks = 0;

      @HostBinding("class.hd-child-on")
      readonly _cls = true;

      @HostListener("click")
      _onClick(): void {
        this.clicks++;
      }

      ngOnInit(): void {
        log.push("child.ngOnInit");
      }
    }

    @Directive({ selector: "[hdHost]", hostDirectives: [HdChild] })
    class HdHost {
      child = inject(HdChild);

      ngOnInit(): void {
        log.push(`host.ngOnInit child=${this.child instanceof HdChild}`);
      }
    }

    @NgModule({ id: "hd.mod", declarations: [HdHost, HdChild] })
    class HdModule {}

    angular.mock.module(configureTestingModule({ imports: [HdModule] }));
    let $compile!: angular.ICompileService;
    let $rootScope!: angular.IRootScopeService;
    angular.mock.inject((_$compile_: angular.ICompileService, _$rootScope_: angular.IRootScopeService) => {
      $compile = _$compile_;
      $rootScope = _$rootScope_;
    });

    const el = $compile("<div hd-host></div>")($rootScope.$new());
    $rootScope.$digest();

    // el @HostBinding de la directiva compuesta corre sobre el elemento del host
    expect(el.hasClass("hd-child-on")).toBe(true);

    // queda publicada → inject(HdChild) desde el host la encuentra
    const host = el.controller("hdHost") as HdHost;
    const child = el.controller("hdChild") as HdChild;
    expect(child).toBeInstanceOf(HdChild);
    expect(host.child).toBe(child);

    // ciclo de vida: la compuesta primero, después el host
    expect(log).toEqual(["child.ngOnInit", "host.ngOnInit child=true"]);

    // el @HostListener de la compuesta también está enganchado
    (el[0] as HTMLElement).dispatchEvent(new MouseEvent("click"));
    expect(child.clicks).toBe(1);
  });
});
