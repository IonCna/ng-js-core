import { describe, expect, it } from "vitest";
import { FormControl } from "@/forms/form-control.ts";
import { Validators } from "@/forms/validators.ts";

describe("etapa 15 — Validators", () => {
  it("required rechaza null/undefined/''/[] y acepta el resto", () => {
    expect(new FormControl(null, Validators.required).errors).toEqual({ required: true });
    expect(new FormControl("", Validators.required).errors).toEqual({ required: true });
    expect(new FormControl([], Validators.required).errors).toEqual({ required: true });
    expect(new FormControl(0, Validators.required).errors).toBeNull();
    expect(new FormControl(false, Validators.required).errors).toBeNull();
    expect(new FormControl("x", Validators.required).errors).toBeNull();
  });

  it("requiredTrue solo acepta true", () => {
    expect(new FormControl(false, Validators.requiredTrue).errors).toEqual({ required: true });
    expect(new FormControl(true, Validators.requiredTrue).errors).toBeNull();
  });

  it("email valida formato y deja pasar vacío (para combinar con required aparte)", () => {
    expect(new FormControl("", Validators.email).errors).toBeNull();
    expect(new FormControl("no-es-email", Validators.email).errors).toEqual({ email: true });
    expect(new FormControl("a@b.com", Validators.email).errors).toBeNull();
  });

  it("min/max comparan numéricamente", () => {
    expect(new FormControl(1, Validators.min(5)).errors).toEqual({ min: { min: 5, actual: 1 } });
    expect(new FormControl(5, Validators.min(5)).errors).toBeNull();
    expect(new FormControl(10, Validators.max(5)).errors).toEqual({ max: { max: 5, actual: 10 } });
  });

  it("minLength/maxLength miden strings y arrays", () => {
    expect(new FormControl("ab", Validators.minLength(3)).errors).toEqual({
      minlength: { requiredLength: 3, actualLength: 2 },
    });
    expect(new FormControl([1, 2, 3, 4], Validators.maxLength(3)).errors).toEqual({
      maxlength: { requiredLength: 3, actualLength: 4 },
    });
    expect(new FormControl("abc", Validators.minLength(3)).errors).toBeNull();
  });

  it("pattern ancla el regex completo como @angular/forms", () => {
    const control = new FormControl("abc123", Validators.pattern("[a-z]+"));
    expect(control.errors).toEqual({
      pattern: { requiredPattern: "/^[a-z]+$/", actualValue: "abc123" },
    });
    expect(new FormControl("abc", Validators.pattern("[a-z]+")).errors).toBeNull();
  });

  it("compose() combina varios validadores y junta los errores", () => {
    const validator = Validators.compose([Validators.required, Validators.minLength(3)]);
    const control = new FormControl("ab", validator);
    expect(control.errors).toEqual({ minlength: { requiredLength: 3, actualLength: 2 } });
    expect(Validators.compose([null, undefined])).toBeNull();
  });

  it("composeAsync() combina validadores async y junta los errores", async () => {
    const takenValidator = () => Promise.resolve<{ taken: true } | null>({ taken: true });
    const validator = Validators.composeAsync([takenValidator]);
    expect(validator).not.toBeNull();

    const control = new FormControl("x");
    control.setAsyncValidators(validator);
    control.updateValueAndValidity();

    await Promise.resolve();
    await Promise.resolve();

    expect(control.errors).toEqual({ taken: true });
  });
});
