import "reflect-metadata";
import "zone.js";
import { describe, expect, it } from "vitest";
import { Component } from "@/core/metadata/component.ts";
import { Directive } from "@/core/metadata/directive.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { ViewChild } from "@/core/queries/view-child.ts";
import { ElementRef, ElementRefImpl } from "@/core/refs/element-ref.ts";
import { TemplateRef } from "@/core/refs/template-ref.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootstrapApplication } from "@/runtime/index.ts";

/**
 * `ng-ref-read` = el `read` de Angular (`@ViewChild(x, { read })`) unido al
 * `exportAs` de `#ref="exportAsName"`. Ver `docs/CONCEPTOS.md`.
 */
describe("ngjs-core/runtime — ng-ref-read: tokens sintéticos + exportAs", () => {
  it('ng-ref-read="ElementRef" da el ElementRef; exportAs distinto del selector da la instancia', async () => {
    const captured: Record<string, unknown> = {};

    @Directive({ selector: "[fooDir]", exportAs: "bar" })
    class FooDir {
      readonly tag = "soy-foo";
    }

    @Component({
      selector: "exp-root",
      controllerAs: "$",
      template: `
        <div foo-dir
             ng-ref="asEl" ng-ref-read="ElementRef"></div>
        <div foo-dir
             ng-ref="asDir" ng-ref-read="bar"></div>
      `,
    })
    class Root {
      @ViewChild("asEl") asEl?: ElementRef;
      @ViewChild("asDir") asDir?: FooDir;

      ngAfterViewInit(): void {
        captured.asEl = this.asEl;
        captured.asDir = this.asDir;
      }
    }

    @NgModule({ declarations: [Root, FooDir] })
    class AppModule {}

    const host = document.createElement("exp-root");
    document.body.appendChild(host);
    const appRef = await bootstrapApplication(AppModule, { hostElement: host });

    expect(captured.asEl).toBeInstanceOf(ElementRefImpl);
    expect(captured.asDir).toBeInstanceOf(FooDir);
    expect((captured.asDir as FooDir).tag).toBe("soy-foo");

    appRef.destroy();
  });

  it('ng-ref-read="TemplateRef" sobre <ng-template> da el TemplateRef', async () => {
    let seen: unknown = "unset";

    @Component({
      selector: "tpl-root",
      controllerAs: "$",
      template: `<ng-template ng-ref="tpl" ng-ref-read="TemplateRef">x</ng-template>`,
    })
    class Root {
      @ViewChild("tpl") tpl?: TemplateRef<unknown>;
      ngAfterViewInit(): void {
        seen = this.tpl;
      }
    }

    @NgModule({ imports: [CommonModule], declarations: [Root] })
    class AppModule {}

    const host = document.createElement("tpl-root");
    document.body.appendChild(host);
    const appRef = await bootstrapApplication(AppModule, { hostElement: host });

    expect(seen).toBeInstanceOf(TemplateRef);

    appRef.destroy();
  });
});
