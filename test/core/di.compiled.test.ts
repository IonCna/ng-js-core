import { afterEach, describe, expect, it } from "vitest";
import { CompiledApp } from "../compiled-app.ts";

/**
 * Porta de la parte de DI de `old/test/core/di/forward-ref.test.ts`: `@Inject(forwardRef(() => X))` con `X` declarada
 * más abajo, resuelto contra el `$injector` real. (Los flags `@Optional`/`@Self`/`@SkipSelf`/`@Host` los cubre
 * `lifecycle.compiled.test.ts`; `inject()` en campos, `runtime.compiled.test.ts`.)
 */
describe("etapa 3 — forwardRef en DI (código compilado)", () => {
  let app: CompiledApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  it("@Inject(forwardRef(() => ServiceB)) resuelve una clase declarada después, y una referencia mutua por forwardRef", async () => {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `
import { Component, forwardRef, Inject, Injectable, NgModule } from "ngjs-core";

@Injectable({ providedIn: "root" })
export class ServiceA { constructor(@Inject(forwardRef(() => ServiceB)) public b: ServiceB) {} }

@Injectable({ providedIn: "root" })
export class ServiceB { readonly tag = "b"; }

@Injectable({ providedIn: "root" })
export class Parent { constructor(@Inject(forwardRef(() => Child)) public child: unknown) {} }

@Injectable({ providedIn: "root" })
export class Child { parent(): unknown { return null; } }

@Component({ selector: "app-root", template: "" })
export class AppComponent {}

@NgModule({ declarations: [AppComponent], bootstrap: [AppComponent] })
export class AppModule {}
`,
      },
      "<app-root></app-root>",
    );
    const a = app.inject<{ b: { tag: string } }>("ServiceA", "test-app");
    expect(a.b).toBe(app.inject("ServiceB", "test-app"));
    expect(a.b.tag).toBe("b");
    expect(app.inject<{ child: unknown }>("Parent", "test-app").child).toBe(app.inject("Child", "test-app"));
  });

  it("InjectionToken con factory de raíz: los providers multi de los módulos reemplazan al default, como en Angular", async () => {
    app = await CompiledApp.bootstrap({
      "app.module.ts": `
import { Component, Inject, InjectionToken, NgModule } from "ngjs-core";

export const HOOKS = new InjectionToken<string[]>("HOOKS", { factory: () => ["default"] });
export const LABELS = new InjectionToken<string[]>("LABELS", { factory: () => ["solo-default"] });

@NgModule({ providers: [{ provide: HOOKS, useValue: "feature", multi: true }] })
export class FeatureModule {}

@Component({ selector: "app-root", template: "" })
export class AppComponent {
  constructor(@Inject(HOOKS) readonly hooks: string[], @Inject(LABELS) readonly labels: string[]) {}
}

@NgModule({
  imports: [FeatureModule],
  declarations: [AppComponent],
  providers: [{ provide: HOOKS, useValue: "own", multi: true }],
  bootstrap: [AppComponent],
})
export class AppModule {}
`,
    });
    const root = app.controller<{ hooks: string[]; labels: string[] }>("app-root", "appRoot");
    expect(root.hooks).toEqual(["feature", "own"]);
    expect(root.labels).toEqual(["solo-default"]);
  });
});
