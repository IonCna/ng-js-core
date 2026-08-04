import type { IComponentController, IComponentOptions } from "angular";
import type { NgTemplateRef } from "../../src/common/ng-template";
import { viewChild } from "../../src/core/viewChild";

interface TemplateContext {
  $implicit: string;
  count: number;
}

interface Person {
  name: string;
  role: string;
}

interface PersonTemplateContext {
  $implicit: Person;
  index: number;
  heading: string;
}

export class DemoAppController implements IComponentController {
  personTemplate!: NgTemplateRef<PersonTemplateContext>;
  primaryTemplate!: NgTemplateRef<TemplateContext>;
  alternateTemplate!: NgTemplateRef<TemplateContext>;

  readonly firstPersonContext: PersonTemplateContext = {
    $implicit: {
      name: "Ada Lovelace",
      role: "Programadora",
    },
    index: 1,
    heading: "Primera instancia",
  };

  readonly secondPersonContext: PersonTemplateContext = {
    $implicit: {
      name: "Grace Hopper",
      role: "Científica computacional",
    },
    index: 2,
    heading: "Segunda instancia",
  };

  test = viewChild.required("test");

  activeTemplate: NgTemplateRef<TemplateContext> | null = null;
  outletContext: TemplateContext = {
    $implicit: "Contexto inicial",
    count: 1,
  };
  showOutlet = true;
  projectionMessage = "Este texto pertenece al scope del consumidor";

  $postLink() {
    this.activeTemplate = this.primaryTemplate;
  }

  usePrimaryTemplate() {
    this.activeTemplate = this.primaryTemplate;
  }

  useAlternateTemplate() {
    this.activeTemplate = this.alternateTemplate;
  }

  clearTemplate() {
    this.activeTemplate = null;
  }

  replaceContext() {
    this.outletContext = {
      $implicit: `Contexto reemplazado ${this.outletContext.count + 1}`,
      count: this.outletContext.count + 1,
    };
  }

  toggleOutlet() {
    this.showOutlet = !this.showOutlet;
  }

  renameProjection() {
    this.projectionMessage = `Contenido actualizado ${Date.now()}`;
  }
}

export const DemoAppComponent: IComponentOptions = {
  controller: DemoAppController,
  templateUrl: "/app/demo-app.component.html",
};
