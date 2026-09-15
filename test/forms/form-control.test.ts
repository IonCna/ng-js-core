import { describe, expect, it, vi } from "vitest";
import { FormControl } from "@/forms/form-control.ts";

describe("etapa 15 — FormControl", () => {
  it("arranca VALID sin validadores y expone el valor inicial", () => {
    const control = new FormControl("hola");
    expect(control.value).toBe("hola");
    expect(control.status).toBe("VALID");
    expect(control.valid).toBe(true);
    expect(control.errors).toBeNull();
  });

  it("valueChanges es BehaviorSubject — un suscriptor tardío ve el valor actual sin esperar el próximo setValue", () => {
    const control = new FormControl("a");
    control.setValue("b");

    const seen: string[] = [];
    control.valueChanges.subscribe((value) => seen.push(value));
    expect(seen).toEqual(["b"]);

    control.setValue("c");
    expect(seen).toEqual(["b", "c"]);
  });

  it("setValue corre el validador sync y recalcula status/errors", () => {
    const control = new FormControl("", (c) => (c.value ? null : { required: true }));
    expect(control.status).toBe("INVALID");
    expect(control.errors).toEqual({ required: true });

    control.setValue("x");
    expect(control.status).toBe("VALID");
    expect(control.errors).toBeNull();
  });

  it("statusChanges emite PENDING y después VALID/INVALID con un validador async", async () => {
    // Promise en vez de of(): la resolución cae en un microtask, así el
    // PENDING intermedio queda registrado antes del valor final (un
    // Observable sync como of() resolvería antes de que updateValueAndValidity
    // termine de emitir, y el PENDING nunca se vería en statusChanges).
    const control = new FormControl("x", null, (c) => Promise.resolve(c.value === "taken" ? { taken: true } : null));

    const statuses: string[] = [];
    control.statusChanges.subscribe((status) => statuses.push(status));

    control.setValue("taken");
    expect(statuses.at(-1)).toBe("PENDING");

    await Promise.resolve();
    await Promise.resolve();

    expect(statuses).toContain("PENDING");
    expect(statuses.at(-1)).toBe("INVALID");
    expect(control.errors).toEqual({ taken: true });
  });

  it("disable() pasa a status DISABLED y enable() vuelve a validar", () => {
    const control = new FormControl("", (c) => (c.value ? null : { required: true }));
    expect(control.status).toBe("INVALID");

    control.disable();
    expect(control.status).toBe("DISABLED");
    expect(control.disabled).toBe(true);
    expect(control.errors).toBeNull();

    control.enable();
    expect(control.status).toBe("INVALID");
  });

  it("markAsTouched/markAsDirty cambian los flags de estado", () => {
    const control = new FormControl("x");
    expect(control.pristine).toBe(true);
    expect(control.untouched).toBe(true);

    control.markAsDirty();
    control.markAsTouched();
    expect(control.dirty).toBe(true);
    expect(control.touched).toBe(true);
  });

  it("reset() vuelve a pristine/untouched y aplica el valor pasado", () => {
    const control = new FormControl("x");
    control.markAsDirty();
    control.markAsTouched();
    control.setValue("y");

    control.reset("z");
    expect(control.value).toBe("z");
    expect(control.pristine).toBe(true);
    expect(control.untouched).toBe(true);
  });

  it("reset({ value, disabled: true }) además deshabilita el control", () => {
    const control = new FormControl("x");
    control.reset({ value: "y", disabled: true });
    expect(control.value).toBe("y");
    expect(control.disabled).toBe(true);
  });

  it("emitEvent: false suprime la emisión en valueChanges/statusChanges", () => {
    const control = new FormControl("a");
    const spy = vi.fn();
    control.valueChanges.subscribe(spy);
    spy.mockClear();

    control.setValue("b", { emitEvent: false });
    expect(spy).not.toHaveBeenCalled();
    expect(control.value).toBe("b");
  });
});
