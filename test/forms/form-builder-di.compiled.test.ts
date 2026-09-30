import { afterEach, describe, expect, it } from "vitest";
import { CompiledApp } from "../compiled-app.ts";

/** Como en Angular: `FormBuilder` y `NonNullableFormBuilder` se inyectan en cualquier lado (`providedIn: "root"`). */
describe("FormBuilder por DI (código compilado)", () => {
  let app: CompiledApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  it("un componente recibe FormBuilder y NonNullableFormBuilder sin proveerlos", async () => {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `
import { Component, NgModule } from "ngjs-core";
import { FormBuilder, NonNullableFormBuilder, ReactiveFormsModule } from "ngjs-core/forms";

@Component({ selector: "app-root", template: "" })
export class AppComponent {
  readonly form = this.fb.group({ name: "Ana" });
  readonly strict = this.strictFb.group({ name: "Ana" });
  constructor(private readonly fb: FormBuilder, private readonly strictFb: NonNullableFormBuilder) {}
}

@NgModule({ imports: [ReactiveFormsModule], declarations: [AppComponent], bootstrap: [AppComponent] })
export class AppModule {}
`,
      },
      "<app-root></app-root>",
    );
    const root = app.controller<{ form: { reset(): void; value: unknown }; strict: { setValue(v: unknown): void; reset(): void; value: unknown } }>("app-root", "appRoot");
    root.form.reset();
    root.strict.setValue({ name: "Luis" });
    root.strict.reset();
    expect(root.form.value).toEqual({ name: null });
    expect(root.strict.value).toEqual({ name: "Ana" });
    expect(app.errors).toEqual([]);
  });
});
