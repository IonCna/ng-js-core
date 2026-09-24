import { describe, expect, it } from "vitest";
import { forwardRef, isForwardRef, resolveForwardRef } from "@/core/di/forward-ref.ts";

/**
 * El `forwardRef` de runtime. Dentro de `@Inject()`/`providers`/`deps` lo desenvuelve el compilador en build (sus
 * tests); el ciclo `@Inject(forwardRef(() => X))` corriendo sobre el `$injector` real lo cubre `di.compiled.test.ts`.
 */
describe("etapa 3 — forwardRef", () => {
  it("resolveForwardRef desenvuelve el thunk", () => {
    class Foo {
      static readonly $name = "Foo";
    }
    const wrapped = forwardRef(() => Foo);
    expect(resolveForwardRef(wrapped)).toBe(Foo);
  });

  it("resolveForwardRef deja pasar cualquier otro valor tal cual", () => {
    expect(resolveForwardRef("$http")).toBe("$http");
    class Foo {}
    expect(resolveForwardRef(Foo)).toBe(Foo);
  });

  it("isForwardRef distingue un forwardRef de cualquier otra cosa", () => {
    class Foo {}
    expect(isForwardRef(forwardRef(() => Foo))).toBe(true);
    expect(isForwardRef(Foo)).toBe(false);
    expect(isForwardRef("$http")).toBe(false);
    expect(isForwardRef(() => Foo)).toBe(false); // una función común, sin el marcador
  });
});
