import { afterEach, describe, expect, it } from "vitest";
import { CompiledApp } from "../compiled-app.ts";

describe("vistas: queries, proyección, templates y composición (código compilado)", () => {
  let app: CompiledApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  it("@ViewChild/@ViewChildren (por clase y por ng-ref), resueltas al entrar a ngAfterViewInit; QueryList emite en changes", async () => {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `
import { AfterViewInit, Component, Directive, ElementRef, Input, NgModule, QueryList, ViewChild, ViewChildren } from "ngjs-core";

@Directive({ selector: "[appItem]" })
export class ItemDirective { @Input() appItem!: string; }

@Component({
  selector: "app-root",
  template: "<b ng-ref='title'>T</b><i app-item=\\"'a'\\"></i><i app-item=\\"'b'\\" ng-if='$ctrl.showB'></i>",
})
export class AppComponent implements AfterViewInit {
  @ViewChild("title", { read: ElementRef }) title!: ElementRef<HTMLElement>;
  @ViewChild(ItemDirective) first!: ItemDirective;
  @ViewChildren(ItemDirective) items!: QueryList<ItemDirective>;
  showB = true;
  seenInit: string[] = [];
  changes = 0;

  ngAfterViewInit(): void {
    this.seenInit = [this.title.nativeElement.tagName, this.first.appItem, ...this.items.map((item) => item.appItem)];
    this.items.changes.subscribe(() => this.changes++);
  }
}

@NgModule({ declarations: [AppComponent, ItemDirective], bootstrap: [AppComponent] })
export class AppModule {}
`,
      },
      "<app-root></app-root>",
    );

    const root = app.controller<{ seenInit: string[]; showB: boolean; changes: number; items: { length: number } }>(
      "app-root",
      "appRoot",
    );
    // Lo de un `ng-if` se linkea en el digest siguiente al `$postLink` (a diferencia de Angular, donde las vistas
    // embebidas ya existen en `ngAfterViewInit`): llega después, por `changes`.
    expect(root.seenInit).toEqual(["B", "a", "a"]);
    app.digest();
    expect(root.items.length).toBe(2);

    const before = root.changes;
    root.showB = false;
    app.digest();
    expect(root.items.length).toBe(1);
    expect(root.changes).toBe(before + 1);
  });

  it("<ng-content> proyecta el contenido y @ContentChildren lo encuentra (proyección eager)", async () => {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `
import { AfterContentInit, Component, ContentChildren, Directive, Input, NgModule, QueryList } from "ngjs-core";

@Directive({ selector: "[appTab]" })
export class TabDirective { @Input() appTab!: string; }

@Component({ selector: "app-tabs", template: '<nav><ng-content></ng-content></nav>' })
export class TabsComponent implements AfterContentInit {
  @ContentChildren(TabDirective) tabs!: QueryList<TabDirective>;
  titles: string[] = [];
  ngAfterContentInit(): void { this.titles = this.tabs.map((tab) => tab.appTab); }
}

@Component({ selector: "app-root", template: "<app-tabs><span app-tab=\\"'uno'\\">1</span><span app-tab=\\"'dos'\\">2</span></app-tabs>" })
export class AppComponent {}

@NgModule({ declarations: [AppComponent, TabsComponent, TabDirective], bootstrap: [AppComponent] })
export class AppModule {}
`,
      },
      "<app-root></app-root>",
    );

    expect(app.document.querySelector("app-tabs nav")?.textContent).toBe("12");
    expect(app.controller<{ titles: string[] }>("app-tabs", "appTabs").titles).toEqual(["uno", "dos"]);
  });

  it("ng-template + ngTemplateOutlet con contexto (let-x)", async () => {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `
import { Component, NgModule, TemplateRef, ViewChild } from "ngjs-core";
import { CommonModule } from "ngjs-core/common";

@Component({
  selector: "app-root",
  template: '<ng-template ng-ref="tpl" let-name="who"><em>hola {{ name }}</em></ng-template><div ng-template-outlet="$ctrl.tpl" ng-template-outlet-context="$ctrl.ctx"></div>',
})
export class AppComponent {
  @ViewChild("tpl") tpl!: TemplateRef<unknown>;
  ctx = { who: "Ana" };
}

@NgModule({ imports: [CommonModule], declarations: [AppComponent], bootstrap: [AppComponent] })
export class AppModule {}
`,
      },
      "<app-root></app-root>",
    );
    app.digest();

    expect(app.document.querySelector("app-root em")?.textContent).toBe("hola Ana");
  });

  it("@Output() con EventEmitter: emit() dispara el (output) del padre con $event, también desde el primer ngOnChanges", async () => {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `
import { Component, EventEmitter, Input, NgModule, Output } from "ngjs-core";

@Component({ selector: "app-child", template: "" })
export class ChildComponent {
  @Input() value!: number;
  @Output() changed = new EventEmitter<number>();
  ngOnChanges(): void { this.changed.emit(this.value * 10); }
}

@Component({ selector: "app-root", template: '<app-child value="2" changed="$ctrl.got.push($event)"></app-child>' })
export class AppComponent { got: number[] = []; }

@NgModule({ declarations: [AppComponent, ChildComponent], bootstrap: [AppComponent] })
export class AppModule {}
`,
      },
      "<app-root></app-root>",
    );

    expect(app.controller<{ got: number[] }>("app-root", "appRoot").got).toEqual([20]);
  });

  it("hostDirectives: la directiva compuesta vive en el mismo elemento (host binding incluido) y el host la puede inyectar", async () => {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `
import { Component, Directive, HostBinding, NgModule } from "ngjs-core";

@Directive({ selector: "[appHighlight]" })
export class HighlightDirective {
  @HostBinding("class.highlighted") on = true;
}

@Component({ selector: "app-card", template: "card", hostDirectives: [HighlightDirective] })
export class CardComponent {
  constructor(readonly highlight: HighlightDirective) {}
}

@Component({ selector: "app-root", template: "<app-card></app-card>" })
export class AppComponent {}

@NgModule({ declarations: [AppComponent, CardComponent, HighlightDirective], bootstrap: [AppComponent] })
export class AppModule {}
`,
      },
      "<app-root></app-root>",
    );
    app.digest();

    const card = app.document.querySelector("app-card")!;
    expect(card.classList.contains("highlighted")).toBe(true);
    const controller = app.controller<{ highlight: { on: boolean } }>("app-card", "appCard");
    expect(controller.highlight.on).toBe(true);
  });

  it("ViewContainerRef.createComponent(): crea un componente declarado, con inputs iniciales y setInput()", async () => {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `
import { Component, Input, NgModule, ViewContainerRef } from "ngjs-core";

@Component({ selector: "app-badge", template: "<i>{{ $ctrl.text }}</i>" })
export class BadgeComponent { @Input() text!: string; }

@Component({ selector: "app-root", template: "<div></div>" })
export class AppComponent {
  constructor(readonly vcr: ViewContainerRef) {}
}

@NgModule({ declarations: [AppComponent, BadgeComponent], bootstrap: [AppComponent] })
export class AppModule {}
`,
      },
      "<div id='host'><app-root></app-root></div>",
    );

    const root = app.controller<{
      vcr: {
        createComponent(
          type: unknown,
          options?: unknown,
        ): PromiseLike<{ setInput(n: string, v: unknown): void; instance: { text: string } }>;
      };
    }>("app-root", "appRoot");
    const BadgeComponent =
      (app.window as unknown as { angular: unknown }) && app.injector.get<unknown[]>("appBadgeDirective");
    expect(BadgeComponent).toBeDefined();

    const ref = await new Promise<{ setInput(n: string, v: unknown): void; instance: { text: string } }>((resolve) => {
      root.vcr.createComponent("appBadge", { bindings: { text: "nuevo" } }).then(resolve);
      app!.digest();
    });
    app.digest();
    expect(app.document.querySelector("#host app-badge i")?.textContent).toBe("nuevo");

    ref.setInput("text", "cambiado");
    app.digest();
    expect(ref.instance.text).toBe("cambiado");
    expect(app.document.querySelector("#host app-badge i")?.textContent).toBe("cambiado");
  });
});
