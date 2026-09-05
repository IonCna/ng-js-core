import "reflect-metadata";
import "zone.js";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { Injectable } from "@/core/di/injectable.ts";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { configureTestingModule } from "@/runtime/testing/index.ts";

@Injectable()
class Greeter {
  greet(): string {
    return "real";
  }
}

@Component({ selector: "tb-widget", controllerAs: "$", template: "<span>{{ $.msg }}</span>" })
class Widget {
  msg: string;
  constructor(g: Greeter) {
    this.msg = g.greet();
  }
}

@Component({
  selector: "tb-card",
  controllerAs: "$",
  transclude: true,
  template: "<header><ng-content></ng-content></header>",
})
class Card {}

@NgModule({ declarations: [Widget, Card], providers: [Greeter] })
class FeatureModule {}

describe("ngjs-core/runtime/testing — configureTestingModule", () => {
  it("expone el módulo para angular.mock.module y respeta providers override", () => {
    const name = configureTestingModule({
      imports: [FeatureModule],
      providers: [{ provide: Greeter, useValue: { greet: () => "fake" } }],
    });

    let text = "";
    angular.mock.module(name);
    angular.mock.inject((_$compile_: angular.ICompileService, _$rootScope_: angular.IRootScopeService) => {
      const el = _$compile_("<tb-widget></tb-widget>")(_$rootScope_.$new() as angular.IScope);
      _$rootScope_.$digest();
      text = (el[0] as HTMLElement).textContent ?? "";
    });

    expect(text).toBe("fake");
  });

  it("proyecta contenido vía <ng-content> de CommonModule", () => {
    const name = configureTestingModule({ imports: [CommonModule, FeatureModule] });

    let projected = "";
    angular.mock.module(name);
    angular.mock.inject((_$compile_: angular.ICompileService, _$rootScope_: angular.IRootScopeService) => {
      const el = _$compile_("<tb-card>proyectado</tb-card>")(_$rootScope_.$new() as angular.IScope);
      _$rootScope_.$digest();
      projected = (el[0] as HTMLElement).querySelector("header")?.textContent?.trim() ?? "";
    });

    expect(projected).toBe("proyectado");
  });
});
