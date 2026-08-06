import type { IComponentOptions, IDirective } from "angular";
import { TemplateRef } from "../../src/common/ng-template";
import { ElementRef, type QueryList } from "../../src/core";
import { ContentChild, contentChild } from "../../src/core/contentChild";
import { ContentChildren, contentChildren } from "../../src/core/contentChildren";
import { ViewContainerRef } from "../../src/core/refs";
import { ViewChild } from "../../src/core/viewChild";

export class ProjectedTemplateBase {}

export class ProjectedTemplateController extends ProjectedTemplateBase {}

export function projectedTemplateDirective(): IDirective {
  return {
    controller: ProjectedTemplateController,
    restrict: "A",
  };
}

export class ProjectionRelayController {
  projectedElement = contentChild("nestedProjectedElement", {
    read: ElementRef,
  });
}

export const ProjectionRelayComponent: IComponentOptions = {
  controller: ProjectionRelayController,
  transclude: true,
  template: `
    <div class="projection-relay">
      <span>Relay: {{$ctrl.projectedElement ? "resuelto" : "undefined"}}</span>
      <ng-content></ng-content>
    </div>
  `,
};

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

  projectedElements = contentChildren("projectedCollectionElement", {
    read: ElementRef,
  });

  @ContentChildren("projectedCollectionElement", { read: ElementRef })
  decoratedProjectedElements!: QueryList<ElementRef<HTMLElement>>;

  contentChildrenChanges = 0;
  private unsubscribeContentChildren?: () => void;

  @ContentChild(ProjectedTemplateController, {
    read: TemplateRef,
    static: true,
  })
  templateFromSiblingDirective!: TemplateRef<unknown>;

  @ContentChild(ProjectedTemplateBase, { static: true })
  inheritedTemplateDirective!: ProjectedTemplateBase;

  nestedProjectedElement = contentChild("nestedProjectedElement", {
    read: ElementRef,
  });

  directNestedProjectedElement = contentChild("nestedProjectedElement", {
    descendants: false,
    read: ElementRef,
  });

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
    const subscription = this.decoratedProjectedElements.changes.subscribe(() => {
      this.contentChildrenChanges++;
    });
    this.unsubscribeContentChildren = () => subscription.unsubscribe();

    console.group("ContentChild: contenido proyectado");
    console.log("@ContentChild(TemplateRef):", this._bodyTpl);
    console.log("@ViewChild read ViewContainerRef:", this._viewVcr);
    console.log("@ContentChild read ViewContainerRef:", this._vcr);
    console.log("contentChild.required read ElementRef:", this.projectedElement);
    console.log("contentChild opcional ausente:", this.missingProjectedElement);
    console.log("contentChildren:", this.projectedElements);
    console.log("@ContentChildren:", this.decoratedProjectedElements);
    console.log("@ContentChild directiva read TemplateRef:", this.templateFromSiblingDirective);
    console.log("@ContentChild por clase base:", this.inheritedTemplateDirective);
    console.log("ContentChild reproyectado:", this.nestedProjectedElement);
    console.log("ContentChild reproyectado directo:", this.directNestedProjectedElement);
    console.groupEnd();
  }

  $onDestroy() {
    this.unsubscribeContentChildren?.();
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
        <span>contentChildren: {{$ctrl.projectedElements.length}} resultados</span>
        <span>@ContentChildren: {{$ctrl.decoratedProjectedElements.length}} resultados</span>
        <span>QueryList.changes: {{$ctrl.contentChildrenChanges}} cambios</span>
        <span>Directiva + read TemplateRef: {{$ctrl.templateFromSiblingDirective ? "resuelto" : "undefined"}}</span>
        <span>Clase base heredada: {{$ctrl.inheritedTemplateDirective ? "resuelto" : "undefined"}}</span>
        <span>ReproyecciÃ³n anidada: {{$ctrl.nestedProjectedElement ? "resuelto" : "undefined"}}</span>
        <span>ReproyecciÃ³n directa: {{$ctrl.directNestedProjectedElement ? "ERROR" : "undefined"}}</span>
      </div>
      <ng-container ng-ref="container"></ng-container>
      <div class="projection-card__body">
        <ng-content></ng-content>
      </div>
    </article>
  `,
};
