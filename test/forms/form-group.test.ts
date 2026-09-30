import { describe, expect, it } from "vitest";
import { FormControl } from "@/forms/form-control.ts";
import { FormGroup } from "@/forms/form-group.ts";
import type { ValidationErrors } from "@/forms/types.ts";
import { Subject } from "rxjs";

/** Un validador async responde al completar (`forkJoin`, como Angular): emite y completa. */
function respond(result: Subject<ValidationErrors | null>, errors: ValidationErrors | null): void {
  result.next(errors);
  result.complete();
}

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
    // Falla antes de tocar nada: ni el control ni el grupo cambian.
    expect(group.controls.name.value).toBe("Ada");
    expect(group.value).toEqual({ name: "Ada", age: 30 });

    group.patchValue({ name: "Grace" });
    expect(group.value).toEqual({ name: "Grace", age: 30 });
  });

  it("disable() en el group deshabilita los hijos y su value los incluye a todos (como Angular)", () => {
    const group = new FormGroup({
      name: new FormControl("Ada"),
      age: new FormControl(30),
    });

    group.disable();
    expect(group.status).toBe("DISABLED");
    expect(group.controls.name.disabled).toBe(true);
    expect(group.value).toEqual({ name: "Ada", age: 30 });
    expect(group.getRawValue()).toEqual({ name: "Ada", age: 30 });

    group.enable();
    expect(group.status).toBe("VALID");
    expect(group.controls.name.enabled).toBe(true);
  });

  it("un grupo con todos sus controles deshabilitados queda DISABLED, con todos en su value (como Angular)", () => {
    const group = new FormGroup({
      name: new FormControl({ value: "Ada", disabled: true }),
      age: new FormControl({ value: 30, disabled: true }),
    });

    expect(group.status).toBe("DISABLED");
    expect(group.disabled).toBe(true);
    expect(group.value).toEqual({ name: "Ada", age: 30 });

    group.controls.age.enable();
    expect(group.status).toBe("VALID");
    expect(group.value).toEqual({ age: 30 });
  });

  it("un grupo vacío no queda DISABLED por no tener hijos habilitados", () => {
    expect(new FormGroup({}).status).toBe("VALID");
  });

  it("addControl/removeControl actualizan value y validez del group", () => {
    const group = new FormGroup({ name: new FormControl("Ada") });

    group.addControl("age", new FormControl(30, (c) => ((c.value as number) >= 0 ? null : { negative: true })));
    expect(group.value).toEqual({ name: "Ada", age: 30 });

    group.removeControl("age");
    expect(group.value).toEqual({ name: "Ada" });
  });

  it("con su propio validador async en vuelo sigue PENDING aunque el del hijo termine (como Angular 16.2)", () => {
    const childResult = new Subject<ValidationErrors | null>();
    const groupResult = new Subject<ValidationErrors | null>();
    const name = new FormControl("Ada", null, () => childResult);
    const group = new FormGroup({ name }, null, () => groupResult);
    expect(group.status).toBe("PENDING");

    respond(childResult, null);
    expect(name.status).toBe("VALID");
    expect(group.status).toBe("PENDING");

    respond(groupResult, { taken: true });
    expect(group.status).toBe("INVALID");
  });

  it("al revalidar se cancela el async en vuelo: con el nuevo resuelto, el estado no queda PENDING", () => {
    let result = new Subject<ValidationErrors | null>();
    const group = new FormGroup({ name: new FormControl("Ada") }, null, () => result);
    const first = result;

    result = new Subject<ValidationErrors | null>();
    group.updateValueAndValidity();
    respond(result, null);
    expect(group.status).toBe("VALID");

    respond(first, { stale: true });
    expect(group.status).toBe("VALID");
  });

  it("reset({ value, disabled: true }) de un hijo lo saca del value del grupo (el estado se aplica antes de propagar)", () => {
    const name = new FormControl("Ada");
    const group = new FormGroup({ name, role: new FormControl("admin") });

    name.reset({ value: "Bea", disabled: true });

    expect(group.value).toEqual({ role: "admin" });
    expect(group.getRawValue()).toEqual({ name: "Bea", role: "admin" });
  });

  it("reset({ value, disabled: false }) de un hijo deshabilitado lo vuelve a meter en el value del grupo", () => {
    const name = new FormControl({ value: "Ada", disabled: true });
    const group = new FormGroup({ name, role: new FormControl("admin") });
    expect(group.value).toEqual({ role: "admin" });

    name.reset({ value: "Bea", disabled: false });

    expect(group.value).toEqual({ name: "Bea", role: "admin" });
  });

  it("reset(valor) sin forma { value, disabled } no cambia si el control está deshabilitado (como Angular)", () => {
    const name = new FormControl({ value: "Ada", disabled: true });
    const group = new FormGroup({ name, role: new FormControl("admin") });

    name.reset("Bea");

    expect(name.disabled).toBe(true);
    expect(name.value).toBe("Bea");
    expect(group.value).toEqual({ role: "admin" });
  });
});

