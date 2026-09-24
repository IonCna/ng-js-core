import { afterEach, describe, expect, it } from "vitest";
import { CompiledApp } from "../compiled-app.ts";

type NgModel = {
  $invalid: boolean;
  $valid: boolean;
  $touched: boolean;
  $error: Record<string, unknown>;
  $pending?: Record<string, unknown>;
};

/**
 * Porta de `old/test/runtime/{control-value-accessor,ng-validators,reactive-forms}.test.ts`: las mismas directivas,
 * ahora compiladas; el markup suelto se compila con `app.compile()` (antes `angular.mock` + `configureTestingModule`).
 */
describe("forms: ControlValueAccessor, NG_VALIDATORS y reactive forms (código compilado)", () => {
  let app: CompiledApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  async function boot(code: string, declarations: string): Promise<CompiledApp> {
    app = await CompiledApp.bootstrap({
      "app.module.ts": `
import { Component, Directive, forwardRef, NgModule } from "ngjs-core";
import { type AbstractControl, type AsyncValidator, type ControlValueAccessor, FormArray, FormControl, FormGroup, FormsModule, NG_ASYNC_VALIDATORS, NG_VALIDATORS, NG_VALUE_ACCESSOR, type Validator, Validators } from "ngjs-core/forms";
${code}
@NgModule({ imports: [FormsModule], declarations: [${declarations}] })
export class AppModule {}
(globalThis as any).forms = { FormArray, FormControl, FormGroup, Validators };
`,
      "main.ts": `import { platformBrowserDynamic } from "ngjs-core";
import { AppModule } from "./app.module";
(globalThis as any).ɵready = platformBrowserDynamic().bootstrapModule(AppModule);
`,
    });
    return app;
  }

  const ngModelOf = (element: { controller(name: string): unknown; find?(s: string): unknown }) => element.controller("ngModel") as NgModel;

  describe("ControlValueAccessor ↔ ngModel", () => {
    const cva = `
@Directive({
  selector: "[fakeCva]",
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => FakeCvaDirective), multi: true }],
})
export class FakeCvaDirective implements ControlValueAccessor {
  written: unknown[] = [];
  disabled: boolean | undefined;
  private onChange: (value: unknown) => void = () => {};
  private onTouched: () => void = () => {};
  writeValue(value: unknown): void { this.written.push(value); }
  registerOnChange(fn: (value: unknown) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }
  typeValue(value: unknown): void { this.onChange(value); }
  touch(): void { this.onTouched(); }
}

@Component({
  selector: "fake-cva-cmp",
  template: "<span>{{ $ctrl.written.length }}</span>",
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => FakeCvaComponent), multi: true }],
})
export class FakeCvaComponent implements ControlValueAccessor {
  written: unknown[] = [];
  private onChange: (value: unknown) => void = () => {};
  writeValue(value: unknown): void { this.written.push(value); }
  registerOnChange(fn: (value: unknown) => void): void { this.onChange = fn; }
  registerOnTouched(_fn: () => void): void {}
  typeValue(value: unknown): void { this.onChange(value); }
}`;
    type Cva = { written: unknown[]; disabled?: boolean; typeValue(v: unknown): void; touch(): void };

    it("modelo → writeValue; vista → modelo (registerOnChange); $touched (registerOnTouched); disabled (setDisabledState)", async () => {
      await boot(cva, "FakeCvaDirective, FakeCvaComponent");
      const { element, scope } = app!.compile<{ model: unknown; dis: boolean }>('<input fake-cva ng-model="model" ng-disabled="dis">', { model: "hola", dis: false });
      const directive = element.controller("fakeCva") as Cva;
      expect(directive.written).toContain("hola");
      expect(directive.disabled).toBe(false);

      directive.typeValue("b");
      scope.$digest();
      expect(scope.model).toBe("b");

      expect(ngModelOf(element).$touched).toBe(false);
      directive.touch();
      scope.$digest();
      expect(ngModelOf(element).$touched).toBe(true);

      scope.dis = true;
      scope.$digest();
      expect(directive.disabled).toBe(true);
    });

    it("funciona sobre un componente con ngModel en el host; sin ngModel no toca nada", async () => {
      await boot(cva, "FakeCvaDirective, FakeCvaComponent");
      const { element, scope } = app!.compile<{ model: unknown }>('<fake-cva-cmp ng-model="model"></fake-cva-cmp>', { model: 3 });
      const component = element.controller("fakeCvaCmp") as Cva;
      expect(component.written).toContain(3);
      component.typeValue(7);
      scope.$digest();
      expect(scope.model).toBe(7);

      const bare = app!.compile("<input fake-cva>").element.controller("fakeCva") as Cva;
      expect(bare.written).toEqual([]);
    });
  });

  describe("NG_VALIDATORS / NG_ASYNC_VALIDATORS ↔ ngModel", () => {
    const validators = `
@Directive({ selector: "[fakeRequired]", providers: [{ provide: NG_VALIDATORS, useExisting: forwardRef(() => FakeRequiredDirective), multi: true }] })
export class FakeRequiredDirective implements Validator {
  validate(control: AbstractControl) { return control.value ? null : { required: true }; }
}
@Directive({ selector: "[fakeMinLength]", providers: [{ provide: NG_VALIDATORS, useExisting: forwardRef(() => FakeMinLengthDirective), multi: true }] })
export class FakeMinLengthDirective implements Validator {
  validate(control: AbstractControl) {
    const value = String(control.value ?? "");
    return value.length >= 3 ? null : { minlength: { requiredLength: 3, actualLength: value.length } };
  }
}
@Directive({ selector: "[fakeTaken]", providers: [{ provide: NG_ASYNC_VALIDATORS, useExisting: forwardRef(() => FakeTakenDirective), multi: true }] })
export class FakeTakenDirective implements AsyncValidator {
  validate(control: AbstractControl) { return Promise.resolve(control.value === "taken" ? { taken: true } : null); }
}`;
    const decls = "FakeRequiredDirective, FakeMinLengthDirective, FakeTakenDirective";

    /** Un `Promise` nativo pasa por varios `.then()` de `$q.when()`: cada salto necesita su microtask + `$digest`. */
    async function flushAsyncValidation(scope: { $digest(): void }, times = 8): Promise<void> {
      for (let i = 0; i < times; i++) {
        await Promise.resolve();
        scope.$digest();
      }
    }

    it("un Validator marca $invalid y $error.<clave>; varios en el mismo elemento, cada uno con su clave", async () => {
      await boot(validators, decls);
      const { element, scope } = app!.compile<{ model: unknown }>('<input fake-required fake-min-length ng-model="model">', { model: "" });
      const ngModel = ngModelOf(element);
      expect(ngModel.$invalid).toBe(true);
      expect(ngModel.$error.required).toBe(true);
      expect(ngModel.$error.minlength).toBe(true);

      scope.model = "ab";
      scope.$digest();
      expect(ngModel.$error.required).toBeUndefined();
      expect(ngModel.$error.minlength).toBe(true);

      scope.model = "abc";
      scope.$digest();
      expect(ngModel.$valid).toBe(true);
    });

    it("un AsyncValidator marca $pending y después $error.<clave>; resuelve válido sin error; sin ngModel no explota", async () => {
      await boot(validators, decls);
      const taken = app!.compile<{ model: unknown }>('<input fake-taken ng-model="model">', { model: "taken" });
      expect(ngModelOf(taken.element).$pending?.ngjsAsyncValidators).toBe(true);
      await flushAsyncValidation(taken.scope);
      expect(ngModelOf(taken.element).$invalid).toBe(true);
      expect(ngModelOf(taken.element).$error.taken).toBe(true);

      const free = app!.compile<{ model: unknown }>('<input fake-taken ng-model="model">', { model: "libre" });
      await flushAsyncValidation(free.scope);
      expect(ngModelOf(free.element).$valid).toBe(true);

      expect(() => app!.compile("<input fake-required>")).not.toThrow();
    });
  });

  describe("[formGroup] / formControlName / formArrayName", () => {
    type Forms = { FormArray: new (c: unknown[]) => any; FormControl: new (v: unknown, validator?: unknown) => any; FormGroup: new (c: object) => any; Validators: { required: unknown } };
    const forms = () => app!.global<Forms>("forms");
    const input = (element: { find(s: string): ArrayLike<HTMLInputElement> }, index = 0) => element.find("input")[index] as HTMLInputElement;
    const type = (target: HTMLInputElement, value: string) => {
      target.value = value;
      target.dispatchEvent(new app!.window.Event("input"));
    };

    it("el valor del FormControl llega al input sin ng-model escrito; lo que se tipea vuelve al FormControl (dirty)", async () => {
      await boot("", "");
      const { FormControl, FormGroup } = forms();
      const form = new FormGroup({ email: new FormControl("ada@example.com") });
      const { element, scope } = app!.compile('<form form-group="form"><input form-control-name="email"></form>', { form });

      expect(input(element).value).toBe("ada@example.com");
      expect(app!.angular.element(input(element)).controller("ngModel")).toBeTruthy();

      type(input(element), "grace@example.com");
      scope.$digest();
      expect(form.controls.email.value).toBe("grace@example.com");
      expect(form.controls.email.dirty).toBe(true);
    });

    it("Validators.required se refleja en $error/$invalid del ngModel real; disable() deshabilita el input", async () => {
      await boot("", "");
      const { FormControl, FormGroup, Validators } = forms();
      const form = new FormGroup({ email: new FormControl("", Validators.required) });
      const { element, scope } = app!.compile('<form form-group="form"><input form-control-name="email"></form>', { form });
      const ngModel = app!.angular.element(input(element)).controller("ngModel") as NgModel;
      expect(ngModel.$invalid).toBe(true);
      expect(ngModel.$error.required).toBe(true);

      type(input(element), "x");
      scope.$digest();
      expect(ngModel.$valid).toBe(true);
      expect(ngModel.$error.required).toBeUndefined();

      expect(input(element).disabled).toBe(false);
      form.controls.email.disable();
      scope.$digest();
      expect(input(element).disabled).toBe(true);
    });

    it("formArrayName resuelve un FormArray anidado y formControlName por índice", async () => {
      await boot("", "");
      const { FormArray, FormControl, FormGroup } = forms();
      const tags = new FormArray([new FormControl("uno"), new FormControl("dos")]);
      const { element, scope } = app!.compile(
        '<form form-group="form"><div form-array-name="tags"><input form-control-name="0"><input form-control-name="1"></div></form>',
        { form: new FormGroup({ tags }) },
      );
      expect(input(element, 0).value).toBe("uno");
      expect(input(element, 1).value).toBe("dos");

      type(input(element, 0), "cambiado");
      scope.$digest();
      expect(tags.value).toEqual(["cambiado", "dos"]);
    });

    it("formControlName con un nombre que no existe en el FormGroup es un error claro", async () => {
      await boot("", "");
      const { FormControl, FormGroup } = forms();
      expect(() =>
        app!.compile('<form form-group="form"><input form-control-name="nope"></form>', { form: new FormGroup({ email: new FormControl("x") }) }),
      ).toThrow(/nope/);
    });
  });
});
