import { describe, expect, it } from "vitest";
import { FormControl } from "@/forms/form-control.ts";
import { FormGroup } from "@/forms/form-group.ts";

describe("etapa 15 — FormGroup", () => {
  it("value agrega el value de cada control hijo", () => {
    const group = new FormGroup({
      name: new FormControl("Ada"),
      age: new FormControl(30),
    });
    expect(group.value).toEqual({ name: "Ada", age: 30 });
  });

  it("es INVALID si cualquier hijo es INVALID, aunque el group no tenga validador propio", () => {
    const group = new FormGroup({
      name: new FormControl("", (c) => (c.value ? null : { required: true })),
      age: new FormControl(30),
    });
    expect(group.status).toBe("INVALID");
    expect(group.get("name")?.errors).toEqual({ required: true });

    group.get("name")?.setValue("Ada");
    expect(group.status).toBe("VALID");
  });

  it("valueChanges del group emite cuando cambia un hijo (propagación hacia el padre)", () => {
    const group = new FormGroup({ name: new FormControl("Ada") });
    const seen: unknown[] = [];
    group.valueChanges.subscribe((value) => seen.push(value));

    group.get("name")?.setValue("Grace");
    expect(seen.at(-1)).toEqual({ name: "Grace" });
  });

  it("get() resuelve por path de string con punto y por array", () => {
    const group = new FormGroup({
      address: new FormGroup({ city: new FormControl("CDMX") }),
    });
    expect(group.get("address.city")?.value).toBe("CDMX");
    expect(group.get(["address", "city"])?.value).toBe("CDMX");
    expect(group.get("address.zip")).toBeNull();
  });

  it("setValue() exige todas las claves; patchValue() acepta un subconjunto", () => {
    const group = new FormGroup({
      name: new FormControl("Ada"),
      age: new FormControl(30),
    });

    expect(() => group.setValue({ name: "Grace" } as never)).toThrow();

    group.patchValue({ name: "Grace" });
    expect(group.value).toEqual({ name: "Grace", age: 30 });
  });

  it("disable() en el group deshabilita los hijos y su value los excluye", () => {
    const group = new FormGroup({
      name: new FormControl("Ada"),
      age: new FormControl(30),
    });

    group.disable();
    expect(group.status).toBe("DISABLED");
    expect(group.controls.name.disabled).toBe(true);
    expect(group.value).toEqual({});
    expect(group.getRawValue()).toEqual({ name: "Ada", age: 30 });
  });

  it("addControl/removeControl actualizan value y validez del group", () => {
    const group = new FormGroup({ name: new FormControl("Ada") });

    group.addControl("age", new FormControl(30, (c) => ((c.value as number) >= 0 ? null : { negative: true })));
    expect(group.value).toEqual({ name: "Ada", age: 30 });

    group.removeControl("age");
    expect(group.value).toEqual({ name: "Ada" });
  });
});
