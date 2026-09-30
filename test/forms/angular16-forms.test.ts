import { describe, expect, it } from "vitest";
import { FormArray } from "@/forms/form-array.ts";
import { FormBuilder } from "@/forms/form-builder.ts";
import { FormControl } from "@/forms/form-control.ts";
import { FormGroup } from "@/forms/form-group.ts";
import { FormRecord } from "@/forms/form-record.ts";
import { isFormArray, isFormControl, isFormGroup, isFormRecord, UntypedFormControl, UntypedFormGroup } from "@/forms/form-types.ts";
import { Validators } from "@/forms/validators.ts";

describe("forms de Angular 14–16", () => {
  it("nonNullable: reset() vuelve al valor inicial (defaultValue); sin la opción, a null", () => {
    const name = new FormControl("Ana", { nonNullable: true });
    const plain = new FormControl("Ana");
    name.setValue("Luis");
    plain.setValue("Luis");
    name.reset();
    plain.reset();
    expect(name.value).toBe("Ana");
    expect(name.defaultValue).toBe("Ana");
    expect(plain.value).toBeNull();
    expect(plain.defaultValue).toBeNull();
  });

  it("fb.nonNullable crea controles nonNullable (valor suelto, tupla y dentro de group)", () => {
    const fb = new FormBuilder();
    const form = fb.nonNullable.group({ name: "Ana", age: [30, Validators.required] });
    form.setValue({ name: "", age: 1 });
    form.reset();
    expect(form.value).toEqual({ name: "Ana", age: 30 });
    expect(form.get("age")!.hasValidator(Validators.required)).toBe(true);
    expect(fb.group({ name: "Ana" }).get("name")).toBeInstanceOf(FormControl);
  });

  it("addValidators/removeValidators/hasValidator por referencia; rigen desde el próximo updateValueAndValidity()", () => {
    const control = new FormControl("");
    expect(control.valid).toBe(true);
    control.addValidators([Validators.required, Validators.required]);
    control.updateValueAndValidity();
    expect(control.hasValidator(Validators.required)).toBe(true);
    expect(control.errors).toEqual({ required: true });
    control.removeValidators(Validators.required);
    control.updateValueAndValidity();
    expect(control.hasValidator(Validators.required)).toBe(false);
    expect(control.valid).toBe(true);
  });

  it("markAllAsTouched() marca el control y todos sus descendientes", () => {
    const form = new FormGroup({ a: new FormControl(1), list: new FormArray([new FormControl(2)]) });
    form.markAllAsTouched();
    expect([form.touched, form.get("a")!.touched, form.get("list")!.touched, (form.get("list") as FormArray).at(0).touched]).toEqual([true, true, true, true]);
  });

  it("FormRecord/fb.record, isForm* y los alias Untyped*", () => {
    const record = new FormBuilder().record({ a: 1, b: 2 });
    record.addControl("c", new FormControl(3));
    expect(record).toBeInstanceOf(FormRecord);
    expect(record.value).toEqual({ a: 1, b: 2, c: 3 });
    expect([isFormRecord(record), isFormGroup(record), isFormControl(record.get("a")), isFormArray(record)]).toEqual([true, true, true, false]);
    expect(UntypedFormControl).toBe(FormControl);
    expect(new UntypedFormGroup({})).toBeInstanceOf(FormGroup);
  });
});
