import { describe, expect, it } from "vitest";
import { FormArray } from "@/forms/form-array.ts";
import { FormBuilder } from "@/forms/form-builder.ts";
import { FormControl } from "@/forms/form-control.ts";
import { FormGroup } from "@/forms/form-group.ts";
import { Validators } from "@/forms/validators.ts";

describe("etapa 15 — FormBuilder", () => {
  const fb = new FormBuilder();

  it("control() arma un FormControl suelto", () => {
    const control = fb.control("x", Validators.required);
    expect(control).toBeInstanceOf(FormControl);
    expect(control.value).toBe("x");
  });

  it("group() acepta valor pelado, tupla [valor, validators] y un control ya armado", () => {
    const group = fb.group({
      name: "Ada",
      age: [30, Validators.min(0)],
      email: fb.control("a@b.com", Validators.email),
    });

    expect(group).toBeInstanceOf(FormGroup);
    expect(group.value).toEqual({ name: "Ada", age: 30, email: "a@b.com" });
    expect(group.controls.age.errors).toBeNull();

    (group.controls.age as FormControl<number>).setValue(-1);
    expect(group.controls.age.errors).toEqual({ min: { min: 0, actual: -1 } });
  });

  it("group() anidado arma un FormGroup dentro de otro", () => {
    const group = fb.group({
      name: "Ada",
      address: fb.group({ city: "CDMX" }),
    });

    expect(group.get("address.city")?.value).toBe("CDMX");
  });

  it("array() arma un FormArray a partir de una lista de control configs", () => {
    const array = fb.array(["a", ["b", Validators.required]]);
    expect(array).toBeInstanceOf(FormArray);
    expect(array.value).toEqual(["a", "b"]);

    array.at(1).setValue("");
    expect(array.status).toBe("INVALID");
  });
});
