import angular from "angular";
import "angular-mocks";
import { beforeEach, describe, expect, it } from "vitest";
import { forwardRef } from "@/core/di/forward-ref.ts";
import { Component } from "@/core/metadata/component.ts";
import { Directive } from "@/core/metadata/directive.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { ControlValueAccessor } from "@/forms/control-value-accessor.ts";
import { NG_VALUE_ACCESSOR } from "@/forms/ng-value-accessor.ts";
import { configureTestingModule } from "@/runtime/testing/index.ts";

@Directive({
  selector: "[fakeCva]",
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => FakeCvaDirective), multi: true }],
})
class FakeCvaDirective implements ControlValueAccessor {
  written: unknown[] = [];
  disabled: boolean | undefined;
  private _onChange: (value: unknown) => void = () => {};
  private _onTouched: () => void = () => {};

  writeValue(value: unknown): void {
    this.written.push(value);
  }
  registerOnChange(fn: (value: unknown) => void): void {
    this._onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this._onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  // helpers de test — simulan interacción del usuario
  typeValue(value: unknown): void {
    this._onChange(value);
  }
  touch(): void {
    this._onTouched();
  }
}

@Component({
  selector: "fake-cva-cmp",
  controllerAs: "$",
  template: "<span>{{ $.written.length }}</span>",
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => FakeCvaComponent), multi: true }],
})
class FakeCvaComponent implements ControlValueAccessor {
  written: unknown[] = [];
  private _onChange: (value: unknown) => void = () => {};

  writeValue(value: unknown): void {
    this.written.push(value);
  }
  registerOnChange(fn: (value: unknown) => void): void {
    this._onChange = fn;
  }
  registerOnTouched(_fn: () => void): void {}
  typeValue(value: unknown): void {
    this._onChange(value);
  }
}

@NgModule({ id: "cva.test.mod", declarations: [FakeCvaDirective, FakeCvaComponent] })
class CvaTestModule {}

describe("ngjs-core/runtime — ControlValueAccessor ↔ ngModel", () => {
  let $compile!: angular.ICompileService;
  let $rootScope!: angular.IRootScopeService;

  beforeEach(() => {
    angular.mock.module(configureTestingModule({ imports: [CvaTestModule] }));
    angular.mock.inject((_$compile_: angular.ICompileService, _$rootScope_: angular.IRootScopeService) => {
      $compile = _$compile_;
      $rootScope = _$rootScope_;
    });
  });

  it("empuja el valor del modelo a writeValue (directiva)", () => {
    const scope = $rootScope.$new() as angular.IScope & { model: unknown };
    scope.model = "hola";
    const el = $compile('<input fake-cva ng-model="model">')(scope);
    scope.$digest();

    const ctrl = el.controller("fakeCva") as FakeCvaDirective;
    expect(ctrl.written).toContain("hola");
  });

  it("propaga el cambio de la vista al modelo via registerOnChange", () => {
    const scope = $rootScope.$new() as angular.IScope & { model: unknown };
    scope.model = "a";
    const el = $compile('<input fake-cva ng-model="model">')(scope);
    scope.$digest();

    const ctrl = el.controller("fakeCva") as FakeCvaDirective;
    ctrl.typeValue("b");
    scope.$digest();

    expect(scope.model).toBe("b");
  });

  it("marca $touched via registerOnTouched", () => {
    const scope = $rootScope.$new() as angular.IScope & { model: unknown };
    scope.model = "a";
    const el = $compile('<input fake-cva ng-model="model">')(scope);
    scope.$digest();

    const ngModel = el.controller("ngModel") as angular.INgModelController;
    expect(ngModel.$touched).toBe(false);

    (el.controller("fakeCva") as FakeCvaDirective).touch();
    scope.$digest();

    expect(ngModel.$touched).toBe(true);
  });

  it("refleja el atributo disabled en setDisabledState", () => {
    const scope = $rootScope.$new() as angular.IScope & { model: unknown; dis: boolean };
    scope.model = "a";
    scope.dis = false;
    const el = $compile('<input fake-cva ng-model="model" ng-disabled="dis">')(scope);
    scope.$digest();

    const ctrl = el.controller("fakeCva") as FakeCvaDirective;
    expect(ctrl.disabled).toBe(false);

    scope.dis = true;
    scope.$digest();
    expect(ctrl.disabled).toBe(true);
  });

  it("funciona sobre un componente (.component) con ngModel en el host", () => {
    const scope = $rootScope.$new() as angular.IScope & { model: unknown };
    scope.model = 3;
    const el = $compile('<fake-cva-cmp ng-model="model"></fake-cva-cmp>')(scope);
    scope.$digest();

    const ctrl = el.controller("fakeCvaCmp") as FakeCvaComponent;
    expect(ctrl.written).toContain(3);

    ctrl.typeValue(7);
    scope.$digest();
    expect(scope.model).toBe(7);
  });

  it("no toca nada si el elemento no tiene ngModel", () => {
    const scope = $rootScope.$new();
    const el = $compile("<input fake-cva>")(scope);
    scope.$digest();

    const ctrl = el.controller("fakeCva") as FakeCvaDirective;
    expect(ctrl.written).toEqual([]);
  });
});
