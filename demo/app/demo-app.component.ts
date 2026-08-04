import type { IComponentController, IComponentOptions } from "angular";
import type { TemplateRef } from "../../src/common/ng-template";

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
  personTemplate!: TemplateRef<PersonTemplateContext>;
  containerTemplate!: TemplateRef<TemplateContext>;
  primaryTemplate!: TemplateRef<TemplateContext>;
  alternateTemplate!: TemplateRef<TemplateContext>;

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

  readonly containerContext: TemplateContext = {
    $implicit: "Renderizado desde ng-container",
    count: 42,
  };
  containerBoundValue = "Binding del controller activo";
  containerClickCount = 0;

  //test = viewChild.required("test");

  activeTemplate: TemplateRef<TemplateContext> | null = null;
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

  incrementContainerCounter() {
    this.containerClickCount++;
  }

  renameProjection() {
    this.projectionMessage = `Contenido actualizado ${Date.now()}`;
  }
}

export const DemoAppComponent: IComponentOptions = {
  controller: DemoAppController,
  templateUrl: "/app/demo-app.component.html",
};
