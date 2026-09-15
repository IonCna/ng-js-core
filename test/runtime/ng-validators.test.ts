import angular from "angular";
import "angular-mocks";
import { beforeEach, describe, expect, it } from "vitest";
import { forwardRef } from "@/core/di/forward-ref.ts";
import { Directive } from "@/core/metadata/directive.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { AbstractControl } from "@/forms/abstract-control.ts";
import { NG_ASYNC_VALIDATORS, NG_VALIDATORS } from "@/forms/ng-validators.ts";
import type { AsyncValidator, Validator } from "@/forms/validator.ts";
import { configureTestingModule } from "@/runtime/testing/index.ts";

@Directive({
  selector: "[fakeRequired]",
  providers: [{ provide: NG_VALIDATORS, useExisting: forwardRef(() => FakeRequiredDirective), multi: true }],
})
class FakeRequiredDirective implements Validator {
  validate(control: AbstractControl) {
    return control.value ? null : { required: true };
  }
}

@Directive({
  selector: "[fakeMinLength]",
  providers: [{ provide: NG_VALIDATORS, useExisting: forwardRef(() => FakeMinLengthDirective), multi: true }],
})
class FakeMinLengthDirective implements Validator {
  validate(control: AbstractControl) {
    const value = String(control.value ?? "");
    return value.length >= 3 ? null : { minlength: { requiredLength: 3, actualLength: value.length } };
  }
}

@Directive({
  selector: "[fakeTaken]",
  providers: [{ provide: NG_ASYNC_VALIDATORS, useExisting: forwardRef(() => FakeTakenDirective), multi: true }],
})
class FakeTakenDirective implements AsyncValidator {
  validate(control: AbstractControl) {
    return Promise.resolve(control.value === "taken" ? { taken: true } : null);
  }
}

@NgModule({
  id: "ng-validators.test.mod",
  declarations: [FakeRequiredDirective, FakeMinLengthDirective, FakeTakenDirective],
})
class NgValidatorsTestModule {}

/**
 * Un `Promise` nativo pasa por `$q.when()` (varios saltos de `.then()`
 * encadenados) antes de que AngularJS lo procese — cada salto necesita su
 * propio microtask + `$digest` para drenar la cola de `$evalAsync`. Confirmado
 * con un probe real: hicieron falta ~5 vueltas para que `$pending` pasara a
 * `undefined`, no 1 ni 2.
 */
async function flushAsyncValidation(scope: angular.IScope, times = 8): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
    scope.$digest();
  }
}

describe("ngjs-core/runtime — NG_VALIDATORS/NG_ASYNC_VALIDATORS ↔ ngModel", () => {
  let $compile!: angular.ICompileService;
  let $rootScope!: angular.IRootScopeService;

  beforeEach(() => {
    angular.mock.module(configureTestingModule({ imports: [NgValidatorsTestModule] }));
    angular.mock.inject((_$compile_: angular.ICompileService, _$rootScope_: angular.IRootScopeService) => {
      $compile = _$compile_;
      $rootScope = _$rootScope_;
    });
  });

  it("una directiva Validator marca $invalid y $error.<clave> en ngModel", () => {
    const scope = $rootScope.$new() as angular.IScope & { model: unknown };
    scope.model = "";
    const el = $compile('<input fake-required ng-model="model">')(scope);
    scope.$digest();

    const ngModel = el.controller("ngModel") as angular.INgModelController;
    expect(ngModel.$invalid).toBe(true);
    expect(ngModel.$error.required).toBe(true);

    scope.model = "x";
    scope.$digest();
    expect(ngModel.$valid).toBe(true);
    expect(ngModel.$error.required).toBeUndefined();
  });

  it("combina varias directivas Validator del mismo elemento — cada una con su propia clave en $error", () => {
    const scope = $rootScope.$new() as angular.IScope & { model: unknown };
    scope.model = "";
    const el = $compile('<input fake-required fake-min-length ng-model="model">')(scope);
    scope.$digest();

    const ngModel = el.controller("ngModel") as angular.INgModelController;
    expect(ngModel.$error.required).toBe(true);
    expect(ngModel.$error.minlength).toBe(true);

    scope.model = "ab";
    scope.$digest();
    expect(ngModel.$error.required).toBeUndefined();
    expect(ngModel.$error.minlength).toBe(true);

    scope.model = "abc";
    scope.$digest();
    expect(ngModel.$valid).toBe(true);
    expect(ngModel.$error.minlength).toBeUndefined();
  });

  it("una directiva AsyncValidator marca $pending y después $error.<clave>", async () => {
    const scope = $rootScope.$new() as angular.IScope & { model: unknown };
    scope.model = "taken";
    const el = $compile('<input fake-taken ng-model="model">')(scope);
    scope.$digest();

    const ngModel = el.controller("ngModel") as angular.INgModelController;
    // La key de $pending es la del $asyncValidators registrado por el bridge
    // (una sola, compartida — ver ng-validators-bridge.ts), no la del error.
    expect(ngModel.$pending?.ngjsAsyncValidators).toBe(true);

    await flushAsyncValidation(scope);

    expect(ngModel.$invalid).toBe(true);
    expect(ngModel.$error.taken).toBe(true);
  });

  it("el async validator resuelve válido cuando no hay error", async () => {
    const scope = $rootScope.$new() as angular.IScope & { model: unknown };
    scope.model = "libre";
    const el = $compile('<input fake-taken ng-model="model">')(scope);
    scope.$digest();

    await flushAsyncValidation(scope);

    const ngModel = el.controller("ngModel") as angular.INgModelController;
    expect(ngModel.$valid).toBe(true);
  });

  it("no toca nada si el elemento no tiene ngModel", () => {
    const scope = $rootScope.$new();
    expect(() => {
      $compile("<input fake-required>")(scope);
      scope.$digest();
    }).not.toThrow();
  });
});
