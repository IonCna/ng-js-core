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

  it("inject(TemplateRef) en una @Directive sobre <ng-template> (construida antes o después de ngTemplate) y @ContentChild de un componente sin <ng-content>", async () => {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `
import { Component, ContentChild, Directive, inject, NgModule, TemplateRef } from "ngjs-core";
import { CommonModule } from "ngjs-core/common";

// "aTpl" < "ngTemplate" < "zTpl": AngularJS construye los controllers de un elemento por prioridad y nombre.
@Directive({ selector: "ng-template[aTpl]" })
export class ATpl { templateRef = inject(TemplateRef); }

@Directive({ selector: "ng-template[zTpl]" })
export class ZTpl { templateRef = inject(TemplateRef); }

@Component({
  selector: "app-list",
  template: '<b ng-template-outlet="$ctrl.a.templateRef" ng-template-outlet-context="{ $implicit: 1 }"></b><i ng-template-outlet="$ctrl.z.templateRef" ng-template-outlet-context="{ $implicit: 2 }"></i>',
})
export class ListComponent {
  @ContentChild(ATpl) a?: ATpl;
  @ContentChild(ZTpl) z?: ZTpl;
}

@Component({
  selector: "app-root",
  template: '<app-list><ng-template a-tpl let-n>A{{ n }}</ng-template><ng-template z-tpl let-n>Z{{ n }}</ng-template></app-list>',
})
export class AppComponent {}

@NgModule({ imports: [CommonModule], declarations: [AppComponent, ListComponent, ATpl, ZTpl], bootstrap: [AppComponent] })
export class AppModule {}
`,
      },
      "<app-root></app-root>",
    );
    app.digest();

    // `ngTemplateOutlet` inserta la vista a continuación de su elemento.
    expect(app.document.querySelector("app-list")?.textContent).toBe("A1Z2");
    expect(app.errors).toEqual([]);
  });

  it("inject(NgDisabled) en una directiva: el ng-disabled del mismo elemento (null sin él, sin heredar del padre)", async () => {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `
import { Component, Directive, inject, NgDisabled, NgModule } from "ngjs-core";

@Directive({ selector: "[appItem]" })
export class ItemDirective {
  ngDisabled = inject(NgDisabled, { optional: true });
  get disabled(): boolean { return !!this.ngDisabled?.disabled; }
}

@Component({
  selector: "app-root",
  template: '<fieldset ng-disabled="$ctrl.off"><button id="a" app-item ng-disabled="$ctrl.off"></button><button id="b" app-item></button></fieldset>',
})
export class AppComponent { off = true; }

@NgModule({ declarations: [AppComponent, ItemDirective], bootstrap: [AppComponent] })
export class AppModule {}
`,
      },
      "<app-root></app-root>",
    );
    app.digest();
    const item = (id: string) => app!.controller<{ ngDisabled: unknown; disabled: boolean }>(`#${id}`, "appItem");

    expect(item("a").disabled).toBe(true);
    expect(item("b").ngDisabled).toBeNull();
    app.controller<{ off: boolean }>("app-root", "appRoot").off = false;
    app.digest();
    expect(item("a").disabled).toBe(false);
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

  it("hostDirectives con inputs/outputs: el host los expone con su alias (expresión, interpolación y output), antes de ngOnInit", async () => {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `
import { Component, Directive, EventEmitter, Input, NgModule, OnChanges, OnInit, Output, SimpleChanges } from "ngjs-core";

@Directive({ selector: "[appTooltip]" })
export class TooltipDirective implements OnChanges, OnInit {
  @Input() text = "";
  @Input({ binding: "@" }) placement = "";
  @Input() hidden = "no expuesto";
  @Output() shown = new EventEmitter<string>();
  log: string[] = [];
  ngOnChanges(changes: SimpleChanges): void { this.log.push("changes:" + Object.keys(changes).sort().join(",") + ":" + changes["text"]?.firstChange); }
  ngOnInit(): void { this.log.push("init:" + this.text + "/" + this.placement); }
}

@Component({
  selector: "app-card",
  template: "card",
  hostDirectives: [{ directive: TooltipDirective, inputs: ["text: tip", "placement"], outputs: ["shown: tipShown"] }],
})
export class CardComponent {
  constructor(readonly tooltip: TooltipDirective) {}
}

@Component({ selector: "app-root", template: '<app-card tip="$ctrl.message" placement="{{ $ctrl.side }}" hidden="\\'x\\'" tip-shown="$ctrl.seen = $event"></app-card>' })
export class AppComponent { message = "hola"; side = "top"; seen = ""; }

@NgModule({ declarations: [AppComponent, CardComponent, TooltipDirective], bootstrap: [AppComponent] })
export class AppModule {}
`,
      },
      "<app-root></app-root>",
    );
    app.digest();

    expect(app.errors).toEqual([]);
    const root = app.controller<{ message: string; side: string; seen: string }>("app-root", "appRoot");
    const tooltip = app.controller<{ tooltip: { text: string; placement: string; hidden: string; log: string[]; shown: { emit(v: string): void } } }>("app-card", "appCard").tooltip;
    expect(tooltip.log).toEqual(["changes:placement,text:true", "init:hola/top"]);
    expect(tooltip.hidden).toBe("no expuesto");

    root.message = "chau";
    root.side = "bottom";
    app.digest();
    expect(tooltip.text).toBe("chau");
    expect(tooltip.placement).toBe("bottom");
    expect(tooltip.log).toContain("changes:text:false");

    tooltip.shown.emit("abierto");
    expect(root.seen).toBe("abierto");
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
