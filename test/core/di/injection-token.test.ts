import { describe, expect, it } from "vitest";
import { InjectionToken } from "@/core/di/injection-token.ts";

/**
 * El nombre de DI de un token (`ɵprov.token`) lo estampa el compilador en build, por símbolo + paquete — no hay un
 * contador en runtime. Acá, lo que el token guarda.
 */
describe("etapa 3 — InjectionToken", () => {
  it("guarda su descripción (toString) — dos tokens con la misma descripción son objetos distintos", () => {
    const a = new InjectionToken("API_URL");
    const b = new InjectionToken("API_URL");
    expect(a.toString()).toBe("API_URL");
    expect(a).not.toBe(b);
  });

  it("sin opciones, no hay factory", () => {
    const token = new InjectionToken<string>("SIN_FACTORY");
    expect(token.options?.factory).toBeUndefined();
  });

  it("con factory, queda guardada tal cual (no corre sola)", () => {
    let ranTimes = 0;
    const factory = () => {
      ranTimes++;
      return "valor";
    };
    const token = new InjectionToken<string>("CON_FACTORY", { factory });

    expect(token.options?.factory).toBe(factory);
    expect(ranTimes).toBe(0);
  });
});
