import { describe, expect, it } from "vitest";
import { NgModule, getNgModuleDef, ngModule } from "@/core/metadata/ng-module.ts";

describe("etapa 4 - ngModule() / @NgModule", () => {
  it("ngModule(Clase).define(def) estampa el NgModuleDef, normalizando arrays faltantes", () => {
    class AppModule {}
    ngModule(AppModule).define({ id: "app" });

    expect(getNgModuleDef(AppModule)).toEqual({ id: "app", declarations: [], imports: [], providers: [] });
  });

  it("@NgModule(def) produce el mismo NgModuleDef que ngModule(Clase).define(def)", () => {
    class Foo {}
    const def = { id: "app", declarations: [Foo] };

    @NgModule(def)
    class AppModule {}

    class AppModuleJs {}
    ngModule(AppModuleJs).define(def);

    expect(getNgModuleDef(AppModule)).toEqual(getNgModuleDef(AppModuleJs));
  });

  it("getNgModuleDef devuelve undefined si la clase nunca paso por ngModule()/@NgModule", () => {
    class SinDef {}
    expect(getNgModuleDef(SinDef)).toBeUndefined();
  });

  it("arrays parciales: declarar solo providers no pisa declarations/imports", () => {
    class SomeProvider {
      static readonly $name = "SomeProvider";
    }
    class AppModule {}
    ngModule(AppModule).define({ id: "app", providers: [SomeProvider] });

    expect(getNgModuleDef(AppModule)).toEqual({
      id: "app",
      declarations: [],
      imports: [],
      providers: [SomeProvider],
    });
  });
});
