import "reflect-metadata";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { CommonModule } from "@/common/common-module.ts";
import { ContentChild } from "@/core/queries/content-child.ts";
import { ContentChildren } from "@/core/queries/content-children.ts";
import type { QueryList } from "@/core/queries/query-list.ts";
import { ViewChild } from "@/core/queries/view-child.ts";
import { ElementRef } from "@/core/refs/element-ref.ts";
import { TemplateRef } from "@/core/refs/template-ref.ts";
import { ViewContainerRef } from "@/core/refs/view-container-ref.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

describe("query options", () => {
  it("ViewChild soporta read: ViewContainerRef con candidato nombrado", () => {
    class Child {}

    class Host {
      @ViewChild("container", { read: ViewContainerRef, static: true })
      vcr?: ViewContainerRef;
    }

    const name = uniqueName("queryReadVcr");
    angular
      .module(name, [CommonModule.name])
      .component("child", { template: "child", controller: Child })
      .component("host", {
        template: '<child ng-ref="container" ng-ref-read="viewContainerRef"></child>',
        controller: Host,
      });

    const host = document.createElement("div");
    host.innerHTML = "<host></host>";
    document.body.appendChild(host);
    angular.bootstrap(host, [name], { strictDi: false });

    const ctrl = angular.element(host.querySelector("host") as Element).controller("host") as Host;
    expect(ctrl.vcr).toBeInstanceOf(ViewContainerRef);
  });

  it("ContentChild soporta read: TemplateRef cuando el candidato expone templateRef", () => {
    class HeaderMarker {
      templateRef!: TemplateRef<unknown>;

      static readonly $factory = () => ({
        restrict: "A",
        controller: HeaderMarker,
        bindToController: true,
        require: {
          templateRef: "ngTemplate",
        },
      });
    }

    class Host {
      @ContentChild(HeaderMarker, { read: TemplateRef, static: true })
      template?: TemplateRef<unknown>;
    }

    const name = uniqueName("queryReadTemplate");
    angular
      .module(name, [CommonModule.name])
      .directive("headerMarker", HeaderMarker.$factory)
      .component("host", {
        template: "<ng-content></ng-content>",
        transclude: true,
        controller: Host,
      });

    const host = document.createElement("div");
    host.innerHTML = "<host><ng-template header-marker>header</ng-template></host>";
    document.body.appendChild(host);
    angular.bootstrap(host, [name], { strictDi: false });

    const ctrl = angular.element(host.querySelector("host") as Element).controller("host") as Host;
    expect(ctrl.template).toBeInstanceOf(TemplateRef);
  });

  it("ViewChild soporta read: ElementRef sobre candidatos por clase", () => {
    class Child {}
    class Host {
      @ViewChild(Child, { read: ElementRef })
      childElement?: ElementRef<HTMLElement>;
    }

    const name = uniqueName("queryReadElement");
    angular
      .module(name, [CommonModule.name])
      .component("child", { template: "child", controller: Child })
      .component("host", { template: "<child></child>", controller: Host });

    const host = document.createElement("div");
    host.innerHTML = "<host></host>";
    document.body.appendChild(host);
    angular.bootstrap(host, [name], { strictDi: false });

    const ctrl = angular.element(host.querySelector("host") as Element).controller("host") as Host;
    expect(ctrl.childElement?.nativeElement).toBe(host.querySelector("child"));
  });

  it("ContentChildren respeta descendants: false contra raices proyectadas", () => {
    class Marker {}
    class Host {
      @ContentChildren(Marker, { descendants: false })
      markers!: QueryList<Marker>;
    }

    const name = uniqueName("queryDescendantsFalse");
    angular
      .module(name, [CommonModule.name])
      .directive("marker", () => ({ restrict: "A", controller: Marker }))
      .component("host", {
        template: "<ng-content></ng-content>",
        transclude: true,
        controller: Host,
      });

    const host = document.createElement("div");
    host.innerHTML = '<host><span marker></span><div><span marker></span></div></host>';
    document.body.appendChild(host);
    angular.bootstrap(host, [name], { strictDi: false });

    const ctrl = angular.element(host.querySelector("host") as Element).controller("host") as Host;
    expect(ctrl.markers.length).toBe(1);
  });
});
