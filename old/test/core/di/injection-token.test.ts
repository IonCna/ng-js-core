import { describe, expect, it } from "vitest";
import { InjectionToken } from "@/core/di/injection-token.ts";

describe("etapa 3 — InjectionToken", () => {
  it("cada instancia tiene un id único, aunque compartan descripción", () => {
    const a = new InjectionToken("API_URL");
    const b = new InjectionToken("API_URL");
    expect(a.toString()).not.toBe(b.toString());
  });

  it("sin factory, queda undefined", () => {
    const token = new InjectionToken<string>("SIN_FACTORY");
    expect(token.factory).toBeUndefined();
  });

  it("con factory, queda guardada tal cual (no corre sola)", () => {
    let ranTimes = 0;
    const factory = () => {
      ranTimes++;
      return "valor";
    };
    const token = new InjectionToken<string>("CON_FACTORY", { factory });

    expect(token.factory).toBe(factory);
    expect(ranTimes).toBe(0); // no se ejecutó al crear el token
  });
});
