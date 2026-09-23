import { describe, expect, it } from "vitest";
import { FormArray } from "@/forms/form-array.ts";
import { FormControl } from "@/forms/form-control.ts";

describe("etapa 15 — FormArray", () => {
  it("value es el array de los value de cada control", () => {
    const array = new FormArray([new FormControl("a"), new FormControl("b")]);
    expect(array.value).toEqual(["a", "b"]);
    expect(array.length).toBe(2);
  });

  it("push/removeAt mutan la lista y recalculan value + validez", () => {
    const array = new FormArray<FormControl<string>>([]);
    array.push(new FormControl("a", (c) => (c.value ? null : { required: true })));
    array.push(new FormControl(""));

    expect(array.value).toEqual(["a", ""]);
    expect(array.status).toBe("VALID");

    array.at(1).setValue("");
    array.controls[0].setValue("");
    expect(array.status).toBe("INVALID");

    array.removeAt(0);
    expect(array.value).toEqual([""]);
  });

  it("valueChanges propaga cuando un control anidado cambia", () => {
    const array = new FormArray([new FormControl("a")]);
    const seen: unknown[] = [];
    array.valueChanges.subscribe((value) => seen.push(value));

    array.at(0).setValue("b");
    expect(seen.at(-1)).toEqual(["b"]);
  });

  it("setValue() valida la longitud; patchValue() tolera un array más corto", () => {
    const array = new FormArray([new FormControl("a"), new FormControl("b")]);
    expect(() => array.setValue(["x"])).toThrow();

    array.setValue(["x", "y"]);
    expect(array.value).toEqual(["x", "y"]);

    array.patchValue(["z"]);
    expect(array.value).toEqual(["z", "y"]);
  });

  it("clear() vacía la lista", () => {
    const array = new FormArray([new FormControl("a"), new FormControl("b")]);
    array.clear();
    expect(array.length).toBe(0);
    expect(array.value).toEqual([]);
  });

  it("get() resuelve por índice", () => {
    const array = new FormArray([new FormControl("a"), new FormControl("b")]);
    expect(array.get([1])?.value).toBe("b");
    expect(array.get("1")?.value).toBe("b");
    expect(array.get([5])).toBeNull();
  });
});
