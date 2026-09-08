import "reflect-metadata";
import "zone.js";
import { describe, expect, it } from "vitest";
import { ContentChild } from "@/core/queries/content-child.ts";
import { ContentChildren } from "@/core/queries/content-children.ts";
import { QueryList } from "@/core/queries/query-list.ts";
import { Component } from "@/core/metadata/component.ts";
import { Directive } from "@/core/metadata/directive.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { bootstrapApplication } from "@/runtime/index.ts";

/**
 * `@ContentChild`/`@ContentChildren` sobre una `@Directive` SIN template: el
 * contenido es light DOM (sin `<ng-content>`), como `NgbNavItem` / `NgbNav` de
 * ng-bootstrap. Debe matchear los descendientes del host igual que en Angular —
 * antes solo funcionaba para componentes con `<ng-content>`.
 */
describe("ngjs-core/runtime — @ContentChild(ren) sobre @Directive sin template (light DOM)", () => {
  it("matchea directivas descendientes del host", async () => {
    const seen: { itemCount: number; firstMatch: boolean } = { itemCount: -1, firstMatch: false };

    @Directive({ selector: "[groupItem]" })
    class GroupItem {}

    @Directive({ selector: "[groupHeader]" })
    class GroupHeader {}

    @Directive({ selector: "[group]" })
    class Group {
      @ContentChildren(GroupItem) items!: QueryList<GroupItem>;
      @ContentChild(GroupHeader) header?: GroupHeader;

      ngAfterContentInit(): void {
        seen.itemCount = this.items.length;
        seen.firstMatch = this.header instanceof GroupHeader;
      }
    }

    @Component({
      selector: "cq-root",
      controllerAs: "$",
      template: `
        <div group>
          <span group-header>hdr</span>
          <span group-item>a</span>
          <span group-item>b</span>
        </div>
      `,
    })
    class Root {}

    @NgModule({ declarations: [Root, Group, GroupItem, GroupHeader] })
    class AppModule {}

    const host = document.createElement("cq-root");
    document.body.appendChild(host);
    const appRef = await bootstrapApplication(AppModule, { hostElement: host });

    expect(seen.itemCount).toBe(2);
    expect(seen.firstMatch).toBe(true);

    appRef.destroy();
  });
});
