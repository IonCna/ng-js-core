import type { IComponentController, IComponentOptions } from "angular";
import { TemplateRef } from "../../src/common/ng-template";
import { ElementRef } from "../../src/core";
import { type EmbeddedViewRef, ViewContainerRef } from "../../src/core/refs";
import { ViewChild, viewChild } from "../../src/core/viewChild";

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
  @ViewChild("decoratedTemplate")
  decoratedTemplate?: TemplateRef<TemplateContext>;

  personTemplate = viewChild.required<TemplateRef<PersonTemplateContext>>("personTemplate");
  firstTemplateByType = viewChild.required(TemplateRef);
  optionalMissingTemplate = viewChild<TemplateRef>("optionalMissingTemplate");
  requiredMissingTemplate = viewChild.required<TemplateRef>("requiredMissingTemplate");
  defaultElement = viewChild.required<ElementRef<HTMLElement>>("defaultElement");
  plainElement = viewChild.required("plainElement", { read: ElementRef });
  personTemplateElement = viewChild.required("personTemplate", { read: ElementRef });
  queriedContainer = viewChild.required("queriedContainer", { read: ViewContainerRef });
  dynamicTemplate = viewChild<TemplateRef<TemplateContext>>("dynamicTemplate");
  firstDuplicateElement = viewChild.required("duplicateElement", { read: ElementRef });
  containerTemplate!: TemplateRef<TemplateContext>;
  containerViewRef: ViewContainerRef | null = null;
  managedTemplate!: TemplateRef<TemplateContext>;
  managedContainerRef: ViewContainerRef | null = null;
  detachedManagedView: EmbeddedViewRef<TemplateContext> | null = null;
  managedContainerLog = "Sin operaciones todavía";
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
  private managedViewSequence = 0;

  activeTemplate: TemplateRef<TemplateContext> | null = null;
  outletContext: TemplateContext = {
    $implicit: "Contexto inicial",
    count: 1,
  };
  showOutlet = true;
  projectionMessage = "Este texto pertenece al scope del consumidor";
  showProjectedContentChild = true;
  showDynamicViewChild = true;
  showFirstDuplicate = true;
  requiredMissingResult = "Sin comprobar";

  $postLink() {
    this.requiredMissingResult = this.readRequiredMissingQuery();

    console.group("viewChild: valor directo");
    console.log("TemplateRef:", this.personTemplate);
    console.log("@ViewChild TemplateRef:", this.decoratedTemplate);
    console.log("Es TemplateRef:", this.personTemplate instanceof TemplateRef);
    console.log("Primer TemplateRef por tipo:", this.firstTemplateByType);
    console.log("El query por tipo no depende de ng-ref:", this.firstTemplateByType !== this.personTemplate);
    console.log("Opcional ausente:", this.optionalMissingTemplate);
    console.log("Required ausente:", this.requiredMissingResult);
    console.log("ElementRef por defecto:", this.defaultElement);
    console.log("ElementRef:", this.plainElement);
    console.log("ElementRef del template:", this.personTemplateElement);
    console.log("ViewContainerRef:", this.queriedContainer);
    console.groupEnd();

    this.activeTemplate = this.primaryTemplate;
    this.activeTemplate.createEmbeddedView;

    console.group("ng-ref-read: viewContainerRef");
    console.log("Referencia:", this.containerViewRef);
    console.log("Es ViewContainerRef:", this.containerViewRef instanceof ViewContainerRef);
    console.log("ElementRef:", this.containerViewRef?.element);
    console.log("Nodo ancla:", this.containerViewRef?.element?.nativeElement);
    console.log("Vistas registradas:", this.containerViewRef?.length);
    console.groupEnd();

    this.logManagedContainer("ViewContainerRef listo");
  }

  toggleDynamicViewChild() {
    this.showDynamicViewChild = !this.showDynamicViewChild;
  }

  toggleFirstDuplicate() {
    this.showFirstDuplicate = !this.showFirstDuplicate;
  }

  logViewChildCases() {
    console.group("viewChild: casos de paridad");
    console.log("Por nombre:", this.personTemplate);
    console.log("Con decorador:", this.decoratedTemplate);
    console.log("Por tipo:", this.firstTemplateByType);
    console.log("Optional ausente:", this.optionalMissingTemplate);
    console.log("Required ausente:", this.readRequiredMissingQuery());
    console.log("ElementRef por defecto:", this.defaultElement);
    console.log("read ElementRef:", this.plainElement);
    console.log("read ElementRef sobre ng-template:", this.personTemplateElement);
    console.log("read ViewContainerRef:", this.queriedContainer);
    console.log("Referencia dinÃ¡mica:", this.dynamicTemplate);
    console.log("Primer duplicado:", this.firstDuplicateElement);
    console.groupEnd();
  }

  appendManagedView() {
    this.createManagedView();
  }

  prependManagedView() {
    this.createManagedView(0);
  }

  detachLastManagedView() {
    const container = this.managedContainerRef;
    if (!container?.length) return this.logManagedContainer("No hay vistas para separar");
    if (this.detachedManagedView) {
      return this.logManagedContainer("Reinserta o destruye primero la vista separada");
    }

    this.detachedManagedView = container.detach() as EmbeddedViewRef<TemplateContext>;
    this.logManagedContainer("Última vista separada sin destruir");
  }

  insertDetachedManagedView() {
    if (!this.managedContainerRef || !this.detachedManagedView) {
      return this.logManagedContainer("No hay una vista separada para reinsertar");
    }

    this.managedContainerRef.insert(this.detachedManagedView, 0);
    this.detachedManagedView = null;
    this.logManagedContainer("Vista separada reinsertada al inicio");
  }

  destroyDetachedManagedView() {
    if (!this.detachedManagedView) {
      return this.logManagedContainer("No hay una vista separada para destruir");
    }

    this.detachedManagedView.destroy();
    this.detachedManagedView = null;
    this.logManagedContainer("Vista separada destruida");
  }

  moveFirstManagedViewToEnd() {
    const container = this.managedContainerRef;
    if (!container || container.length < 2) {
      return this.logManagedContainer("Se necesitan al menos dos vistas para mover");
    }

    const firstView = container.get(0);
    if (!firstView) return;

    container.move(firstView, container.length - 1);
    this.logManagedContainer("Primera vista movida al final");
  }

  removeLastManagedView() {
    if (!this.managedContainerRef?.length) {
      return this.logManagedContainer("No hay vistas para eliminar");
    }

    this.managedContainerRef.remove();
    this.logManagedContainer("Última vista eliminada y destruida");
  }

  clearManagedContainer() {
    this.managedContainerRef?.clear();
    this.logManagedContainer("Container limpiado");
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

  toggleProjectedContentChild() {
    this.showProjectedContentChild = !this.showProjectedContentChild;
  }

  private createManagedView(index?: number) {
    if (!this.managedContainerRef) {
      return this.logManagedContainer("ViewContainerRef todavía no está disponible");
    }

    const id = ++this.managedViewSequence;
    this.managedContainerRef.createEmbeddedView(
      this.managedTemplate,
      {
        $implicit: `Vista administrada ${id}`,
        count: id,
      },
      { index },
    );

    this.logManagedContainer(index === 0 ? `Vista ${id} insertada al inicio` : `Vista ${id} agregada`);
  }

  private readRequiredMissingQuery(): string {
    try {
      void this.requiredMissingTemplate;
      return "ERROR: no lanzÃ³ una excepciÃ³n";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  private logManagedContainer(operation: string) {
    const container = this.managedContainerRef;
    this.managedContainerLog = operation;

    console.group(`ViewContainerRef: ${operation}`);
    console.log("Container:", container);
    console.log("Longitud:", container?.length ?? 0);
    console.log("Vista separada:", this.detachedManagedView);
    console.table(
      Array.from({ length: container?.length ?? 0 }, (_, index) => {
        const view = container?.get(index) as EmbeddedViewRef<TemplateContext> | null;
        return {
          index,
          message: view?.context.$implicit,
          count: view?.context.count,
          destroyed: view?.destroyed,
        };
      }),
    );
    console.groupEnd();
  }
}

export const DemoAppComponent: IComponentOptions = {
  controller: DemoAppController,
  templateUrl: "/app/demo-app.component.html",
};
