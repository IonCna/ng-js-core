import { afterEach, describe, expect, it } from "vitest";
import { CompiledApp } from "../compiled-app.ts";

/**
 * Metadata de Angular 16 en el objeto del decorador (`inputs`/`outputs`/`host`/`queries`) y `@Input({ transform })`,
 * compilada con `ng-js-compiler` y corriendo con los bridges reales del core (outputs → `EventEmitter`, queries).
 */
describe("metadata de decorador de Angular 16 (código compilado)", () => {
  let app: CompiledApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  async function boot(code: string, declarations: string, html: string): Promise<CompiledApp> {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `import { AfterViewInit, booleanAttribute, Component, ContentChildren, Directive, ElementRef, EventEmitter, Input, NgModule, numberAttribute, QueryList, ViewChild } from "ngjs-core";
import { CommonModule } from "ngjs-core/common";
${code}
@NgModule({ imports: [CommonModule], declarations: [${declarations}] })
export class AppModule {}
`,
        "main.ts": `import { platformBrowserDynamic } from "ngjs-core";
import { AppModule } from "./app.module";
(globalThis as any).ɵready = platformBrowserDynamic().bootstrapModule(AppModule);
`,
      },
      html,
    );
    app.digest();
    return app;
  }

  const ctrl = <T>(selector: string, name: string) =>
    app!.angular.element(app!.document.querySelector(selector)!).controller(name) as T;

  it("inputs/outputs del decorador: el output es un EventEmitter conectado al binding del padre", async () => {
    await boot(
      `@Component({ selector: "app-item", template: "<b>{{ $ctrl.label }}</b>", inputs: ["label: text"], outputs: ["picked: choose"] })
export class Item {
  label = "";
  picked = new EventEmitter<string>();
}
@Component({ selector: "app-list", template: "<app-item text=\\"'uno'\\" choose=\\"$ctrl.last = $event\\"></app-item>" })
export class List { last = ""; }`,
      "Item, List",
      "<app-list></app-list>",
    );
    const item = ctrl<{ label: string; picked: EventEmitter }>("app-item", "appItem");
    expect(item.label).toBe("uno");
    expect(app!.document.querySelector("app-item b")!.textContent).toBe("uno");

    item.picked.emit("elegido");
    app!.digest();
    expect(ctrl<{ last: string }>("app-list", "appList").last).toBe("elegido");
  });

  it("@Input({ transform: booleanAttribute / numberAttribute }): el valor del binding llega transformado", async () => {
    await boot(
      `@Directive({ selector: "[appFlag]" })
export class Flag {
  @Input({ transform: booleanAttribute }) appFlag = false;
  @Input({ transform: numberAttribute }) size = 0;
}`,
      "Flag",
      `<span app-flag="''" size="'12'"></span><i app-flag="'false'" size="'x'"></i>`,
    );
    const on = app!.angular.element(app!.document.querySelector("span")!).controller("appFlag") as { appFlag: boolean; size: number };
    const off = app!.angular.element(app!.document.querySelector("i")!).controller("appFlag") as { appFlag: boolean; size: number };
    expect(on).toMatchObject({ appFlag: true, size: 12 });
    expect(off.appFlag).toBe(false);
    expect(off.size).toBeNaN();
  });

  it("host: {} y queries: {} del decorador", async () => {
    await boot(
      `@Component({
  selector: "app-panel",
  template: "<span ng-ref=\\"title\\">t</span>",
  host: { role: "region", "[class.open]": "open", "(click)": "open = !open" },
  queries: { title: new ViewChild("title") },
})
export class Panel implements AfterViewInit {
  open = false;
  title?: ElementRef<HTMLElement>;
  seen = "";
  ngAfterViewInit(): void { this.seen = this.title!.nativeElement.textContent ?? ""; }
}`,
      "Panel",
      "<app-panel></app-panel>",
    );
    const el = app!.document.querySelector("app-panel")!;
    const panel = ctrl<{ open: boolean; seen: string }>("app-panel", "appPanel");
    expect(el.getAttribute("role")).toBe("region");
    expect(panel.seen).toBe("t");
    expect(el.classList.contains("open")).toBe(false);

    el.dispatchEvent(new app!.dom.window.MouseEvent("click", { bubbles: true }));
    expect(panel.open).toBe(true);
    expect(el.classList.contains("open")).toBe(true);
  });
});
