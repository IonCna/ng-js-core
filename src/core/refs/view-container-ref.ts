import type angular from "angular";
import type { IPromise, IQService } from "angular";
import { createComponent } from "@/core/create-component.ts";
import type { ComponentRef } from "@/core/refs/component-ref.ts";
import type { ElementRefImpl } from "@/core/refs/element-ref.ts";
import { claimView, getViewOwner, releaseView, type ViewOwner } from "@/core/refs/view-owner.ts";
import type { ViewRef, ViewRefImpl } from "@/core/refs/view-ref.ts";

export abstract class ViewContainerRef {
  static readonly $name = "ViewContainerRef";

  abstract readonly element: ElementRefImpl;
  abstract clear(): void;
  abstract get(index: number): ViewRef | null;
  abstract readonly length: number;
  abstract insert(viewRef: ViewRef, index?: number): ViewRef;
  abstract move(viewRef: ViewRef, currentIndex: number): ViewRef;
  abstract indexOf(viewRef: ViewRef): number;
  abstract remove(index?: number): void;
  abstract detach(index?: number): ViewRef | null;
  abstract createComponent<C>(
    componentType: Function,
    options?: {
      index?: number;
      projectableNodes?: Node[][];
      directives?: string[];
      bindings?: Readonly<Record<string, unknown>>;
    },
  ): IPromise<ComponentRef<C>>;
}

/**
 * `TemplateRef`/`createEmbeddedView` quedaron para etapa 8 (necesitan un
 * `$transclude` real, que da el directive de `<ng-template>`) — ver
 * `docs/ORDEN-DE-CONSTRUCCION.md`.
 */
export class ViewContainerRefImpl extends ViewContainerRef implements ViewOwner {
  readonly viewOwnerKind = "container" as const;
  private readonly views: ViewRef[] = [];
  private readonly trackedViews = new WeakSet<ViewRef>();

  constructor(
    public readonly element: ElementRefImpl,
    private readonly injector: angular.auto.IInjectorService,
  ) {
    super();
  }

  get length(): number {
    return this.views.length;
  }

  clear(): void {
    while (this.length) this.remove(this.length - 1);
  }

  createComponent<C>(
    componentType: Function,
    options?: {
      index?: number;
      projectableNodes?: Node[][];
      directives?: string[];
      bindings?: Readonly<Record<string, unknown>>;
    },
  ): IPromise<ComponentRef<C>> {
    const $q = this.injector.get<IQService>("$q");

    return createComponent<C>(componentType, {
      injector: this.injector,
      projectableNodes: options?.projectableNodes,
      directives: options?.directives,
      bindings: options?.bindings,
    }).then((componentRef) => {
      try {
        this.insert(componentRef.hostView, options?.index);
        return componentRef;
      } catch (error) {
        componentRef.destroy();
        return $q.reject(error);
      }
    });
  }

  get(index: number): ViewRef | null {
    return this.views[index] ?? null;
  }

  indexOf(viewRef: ViewRef): number {
    return this.views.indexOf(viewRef);
  }

  insert(viewRef: ViewRef, index?: number): ViewRef {
    if (viewRef.destroyed) {
      throw new Error("No se puede insertar una vista destruida");
    }

    const currentOwner = getViewOwner(viewRef);
    if (currentOwner) {
      if (!(currentOwner instanceof ViewContainerRefImpl)) {
        throw new Error("La vista pertenece a ApplicationRef y debe separarse antes de insertarla");
      }

      const currentIndex = currentOwner.indexOf(viewRef);
      if (currentIndex !== -1) currentOwner.detach(currentIndex);
    }

    const targetIndex = this.normalizeInsertIndex(index);
    const anchor = this.element.nativeElement as Node;
    const parent = anchor.parentNode;

    if (!parent) {
      throw new Error("El ViewContainerRef no tiene un ancla conectada al DOM");
    }

    const referenceNode = this.getInsertionReference(targetIndex);
    const rootNodes = this.getRootNodes(viewRef);

    for (const node of rootNodes) parent.insertBefore(node, referenceNode);

    this.views.splice(targetIndex, 0, viewRef);
    claimView(viewRef, this);
    viewRef.reattach();
    this.trackDestroyedView(viewRef);

    return viewRef;
  }

  move(viewRef: ViewRef, currentIndex: number): ViewRef {
    if (this.indexOf(viewRef) === -1) {
      throw new Error("La vista no pertenece a este ViewContainerRef");
    }

    return this.insert(viewRef, currentIndex);
  }

  remove(index?: number): void {
    const viewRef = this.detach(index);
    viewRef?.destroy();
  }

  detach(index?: number): ViewRef | null {
    const targetIndex = index ?? this.length - 1;
    if (targetIndex < 0 || targetIndex >= this.length) return null;

    const [viewRef] = this.views.splice(targetIndex, 1);

    for (const node of this.getRootNodes(viewRef)) {
      node.parentNode?.removeChild(node);
    }

    releaseView(viewRef, this);
    viewRef.detach();

    return viewRef;
  }

  private normalizeInsertIndex(index?: number): number {
    const targetIndex = index ?? this.length;

    if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex > this.length) {
      throw new RangeError(`índice de inserción fuera de rango: ${targetIndex}`);
    }

    return targetIndex;
  }

  private getRootNodes(viewRef: ViewRef): Node[] {
    const rootNodes = (viewRef as Partial<ViewRefImpl>).rootNodes;

    if (!rootNodes) {
      throw new Error("La vista no expone rootNodes y no puede insertarse");
    }

    return Array.from(rootNodes);
  }

  private getInsertionReference(index: number): Node | null {
    for (let current = index; current < this.length; current++) {
      const [firstNode] = this.getRootNodes(this.views[current]);
      if (firstNode) return firstNode;
    }

    for (let current = index - 1; current >= 0; current--) {
      const rootNodes = this.getRootNodes(this.views[current]);
      const lastNode = rootNodes[rootNodes.length - 1];
      if (lastNode) return lastNode.nextSibling;
    }

    return (this.element.nativeElement as Node).nextSibling;
  }

  private trackDestroyedView(viewRef: ViewRef): void {
    if (this.trackedViews.has(viewRef)) return;

    this.trackedViews.add(viewRef);
    viewRef.onDestroy(() => {
      const index = this.views.indexOf(viewRef);
      if (index !== -1) this.views.splice(index, 1);

      releaseView(viewRef, this);
    });
  }
}
