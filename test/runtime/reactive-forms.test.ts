import angular from "angular";
import "angular-mocks";
import { beforeEach, describe, expect, it } from "vitest";
import { FormArray } from "@/forms/form-array.ts";
import { FormControl } from "@/forms/form-control.ts";
import { FormGroup } from "@/forms/form-group.ts";
import { Validators } from "@/forms/validators.ts";
import { formsModule } from "@/runtime/forms/index.ts";
import { configureTestingModule } from "@/runtime/testing/index.ts";

type FormScope = angular.IScope & Record<string, unknown>;

describe("ngjs-core/runtime — [formGroup] / formControlName / formArrayName", () => {
  let $compile!: angular.ICompileService;
  let $rootScope!: angular.IRootScopeService;

  beforeEach(() => {
    angular.mock.module(configureTestingModule({ imports: [formsModule()] }));
    angular.mock.inject((_$compile_: angular.ICompileService, _$rootScope_: angular.IRootScopeService) => {
      $compile = _$compile_;
      $rootScope = _$rootScope_;
    });
  });

  it("empuja el valor del FormControl al input sin que el autor escriba ng-model", () => {
    const scope = $rootScope.$new() as FormScope;
    const form = new FormGroup({ email: new FormControl("ada@example.com") });
    scope.form = form;

    const el = $compile('<form form-group="form"><input form-control-name="email"></form>')(scope);
    scope.$digest();

    const input = el.find("input")[0] as HTMLInputElement;
    expect(input.value).toBe("ada@example.com");
    // el autor no escribió ng-model — confirmar que igual quedó instanciado por debajo
    expect(angular.element(input).controller("ngModel")).toBeTruthy();
  });

  it("propaga lo que el usuario tipea al FormControl (vía evento input nativo)", () => {
    const scope = $rootScope.$new() as FormScope;
    const form = new FormGroup({ email: new FormControl("a@b.com") });
    scope.form = form;

    const el = $compile('<form form-group="form"><input form-control-name="email"></form>')(scope);
    scope.$digest();

    const input = el.find("input")[0] as HTMLInputElement;
    input.value = "grace@example.com";
    input.dispatchEvent(new Event("input"));
    scope.$digest();

    expect(form.controls.email.value).toBe("grace@example.com");
    expect(form.controls.email.dirty).toBe(true);
  });

  it("refleja Validators.required del FormControl en $error/$invalid del ngModel real", () => {
    const scope = $rootScope.$new() as FormScope;
    const form = new FormGroup({ email: new FormControl("", Validators.required) });
    scope.form = form;

    const el = $compile('<form form-group="form"><input form-control-name="email"></form>')(scope);
    scope.$digest();

    const input = el.find("input");
    const ngModel = input.controller("ngModel") as angular.INgModelController;
    expect(ngModel.$invalid).toBe(true);
    expect(ngModel.$error.required).toBe(true);

    (input[0] as HTMLInputElement).value = "x";
    input[0].dispatchEvent(new Event("input"));
    scope.$digest();

    expect(ngModel.$valid).toBe(true);
    expect(ngModel.$error.required).toBeUndefined();
  });

  it("un FormControl.disable() deshabilita el input real", () => {
    const scope = $rootScope.$new() as FormScope;
    const form = new FormGroup({ email: new FormControl("x") });
    scope.form = form;

    const el = $compile('<form form-group="form"><input form-control-name="email"></form>')(scope);
    scope.$digest();

    const input = el.find("input")[0] as HTMLInputElement;
    expect(input.disabled).toBe(false);

    form.controls.email.disable();
    scope.$digest();
    expect(input.disabled).toBe(true);
  });

  it("formArrayName resuelve un FormArray anidado y formControlName por índice", () => {
    const scope = $rootScope.$new() as FormScope;
    const tags = new FormArray([new FormControl("uno"), new FormControl("dos")]);
    const form = new FormGroup({ tags });
    scope.form = form;

    const el = $compile(
      '<form form-group="form"><div form-array-name="tags">' +
        '<input form-control-name="0"><input form-control-name="1">' +
        "</div></form>",
    )(scope);
    scope.$digest();

    const inputs = el.find("input");
    expect((inputs[0] as unknown as HTMLInputElement).value).toBe("uno");
    expect((inputs[1] as unknown as HTMLInputElement).value).toBe("dos");

    (inputs[0] as unknown as HTMLInputElement).value = "cambiado";
    inputs[0].dispatchEvent(new Event("input"));
    scope.$digest();

    expect(tags.value).toEqual(["cambiado", "dos"]);
  });

  it("formControlName con un nombre que no existe en el FormGroup tira un error claro", () => {
    const scope = $rootScope.$new() as FormScope;
    scope.form = new FormGroup({ email: new FormControl("x") });

    expect(() => {
      $compile('<form form-group="form"><input form-control-name="nope"></form>')(scope);
      scope.$digest();
    }).toThrow(/nope/);
  });
});
