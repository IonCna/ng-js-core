import { describe, expect, it } from "vitest";
import * as common from "@/common/index.ts";
import * as core from "@/core/index.ts";
import * as platformBrowser from "@/platform-browser/index.ts";

/** Lo que el código de Angular 16 importa desde el subpath de Angular (`migrate` solo cambia `ngjs-core/X` → `@angular/X`). */
describe("exports en el subpath de Angular 16", () => {
  it("@angular/core", () => {
    for (const name of ["LOCALE_ID", "SecurityContext", "isDevMode", "enableProdMode", "VERSION", "Version", "ENVIRONMENT_INITIALIZER"]) {
      expect(core, name).toHaveProperty(name);
    }
  });

  it("@angular/common y @angular/platform-browser", () => {
    for (const name of ["DOCUMENT", "registerLocaleData"]) expect(common, name).toHaveProperty(name);
    for (const name of ["bootstrapApplication", "platformBrowser"]) expect(platformBrowser, name).toHaveProperty(name);
    expect(common.DOCUMENT).toBe(core.DOCUMENT);
  });
});
