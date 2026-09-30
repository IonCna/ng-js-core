import { afterEach, describe, expect, it } from "vitest";
import { CompiledApp } from "../compiled-app.ts";

/**
 * Código de Angular 16 tal cual: `exports` de `@NgModule`, `viewProviders`, `ENVIRONMENT_INITIALIZER` y lo de `@angular/core` que se
 * importa desde el subpath de Angular (`DOCUMENT` y `registerLocaleData` desde `common`).
 */
describe("superficie de Angular 16 (código compilado)", () => {
  let app: CompiledApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  it("exports, viewProviders, ENVIRONMENT_INITIALIZER, isDevMode/VERSION y DOCUMENT desde common", async () => {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `
import { Component, ENVIRONMENT_INITIALIZER, Inject, Injectable, isDevMode, NgModule, VERSION } from "ngjs-core";
import { CommonModule, DOCUMENT } from "ngjs-core/common";

@Injectable()
export class Theme { name = "oscuro"; }

@Component({
  selector: "app-badge",
  template: "<b>{{ $ctrl.theme.name }}|{{ $ctrl.title }}</b>",
  viewProviders: [Theme],
})
export class BadgeComponent {
  title: string;
  constructor(readonly theme: Theme, @Inject(DOCUMENT) doc: Document) { this.title = doc.title; }
}

@NgModule({ declarations: [BadgeComponent], exports: [BadgeComponent] })
export class BadgeModule {}

@NgModule({ imports: [CommonModule], exports: [BadgeModule, CommonModule] })
export class SharedModule {}

@Component({ selector: "app-root", template: "<app-badge></app-badge>" })
export class AppComponent {}

(globalThis as any).initialized = [];
@NgModule({
  imports: [SharedModule],
  declarations: [AppComponent],
  bootstrap: [AppComponent],
  providers: [{ provide: ENVIRONMENT_INITIALIZER, multi: true, useValue: () => (globalThis as any).initialized.push("env") }],
})
export class AppModule {}
(globalThis as any).meta = { dev: isDevMode(), major: VERSION.major };
`,
      },
      "<app-root></app-root>",
    );
    app.document.title = "Doc";
    app.digest();

    expect(app.document.querySelector("app-badge")?.textContent).toMatch(/^oscuro\|/);
    expect(app.global<string[]>("initialized")).toEqual(["env"]);
    expect(app.global<{ dev: boolean; major: string }>("meta")).toEqual({ dev: true, major: "16" });
    expect(app.errors).toEqual([]);
  });
});
