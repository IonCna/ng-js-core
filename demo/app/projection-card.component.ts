import type { IComponentOptions } from "angular";
import { TemplateRef } from "../../src/common/ng-template";
import { ElementRef } from "../../src/core";
import { ContentChild, contentChild } from "../../src/core/contentChild";
import { ViewContainerRef } from "../../src/core/refs";
import { ViewChild } from "../../src/core/viewChild";

export class ProjectionCardController {
  title?: string;

  @ContentChild(TemplateRef, { static: true })
  private _bodyTpl!: TemplateRef<unknown>;

  @ViewChild("container", { read: ViewContainerRef, static: true })
  private _viewVcr!: ViewContainerRef;

  @ContentChild("projectedContainer", {
    read: ViewContainerRef,
    static: true,
  })
  private _vcr!: ViewContainerRef;

  projectedElement = contentChild.required("projectedElement", {
    read: ElementRef,
  });

  dynamicProjectedElement = contentChild("dynamicProjectedElement", {
    read: ElementRef,
  });

  missingProjectedElement = contentChild<ElementRef>("missingProjectedElement");

  get bodyTemplate(): TemplateRef<unknown> {
    return this._bodyTpl;
  }

  get projectedContainer(): ViewContainerRef {
    return this._vcr;
  }

  get viewContainer(): ViewContainerRef {
    return this._viewVcr;
  }

  $postLink() {
    console.group("ContentChild: contenido proyectado");
    console.log("@ContentChild(TemplateRef):", this._bodyTpl);
    console.log("@ViewChild read ViewContainerRef:", this._viewVcr);
    console.log("@ContentChild read ViewContainerRef:", this._vcr);
    console.log("contentChild.required read ElementRef:", this.projectedElement);
    console.log("contentChild opcional ausente:", this.missingProjectedElement);
    console.groupEnd();
  }
}

export const ProjectionCardComponent: IComponentOptions = {
  bindings: {
    title: "@",
  },
  controller: ProjectionCardController,
  transclude: true,
  template: `
    <article class="projection-card">
      <header class="projection-card__header">{{$ctrl.title}}</header>
      <div class="container-state">
        <span>@ViewChild ViewContainerRef: {{$ctrl.viewContainer ? "resuelto" : "undefined"}}</span>
        <span>@ContentChild TemplateRef: {{$ctrl.bodyTemplate ? "resuelto" : "undefined"}}</span>
        <span>@ContentChild ViewContainerRef: {{$ctrl.projectedContainer ? "resuelto" : "undefined"}}</span>
        <span>contentChild.required ElementRef: {{$ctrl.projectedElement ? "resuelto" : "undefined"}}</span>
        <span>contentChild opcional ausente: {{$ctrl.missingProjectedElement === undefined ? "undefined" : "ERROR"}}</span>
        <span>contentChild dinÃ¡mico: {{$ctrl.dynamicProjectedElement ? "resuelto" : "undefined"}}</span>
      </div>
      <ng-container ng-ref="container"></ng-container>
      <div class="projection-card__body">
        <ng-content></ng-content>
      </div>
    </article>
  `,
};
