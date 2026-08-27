import angular from "angular";
import type { TemplateRef } from "@/common/ng-template.ts";
import type { Binding } from "@/core/index.ts";
import { ComponentRef, ComponentRefImpl } from "@/core/abstractions/component-ref";
import { ElementRef, ElementRefImpl } from "@/core/abstractions/element-ref";
import { EmbeddedViewRef, EmbeddedViewRefImpl } from "@/core/abstractions/embedded-view-ref";
import { ViewRef, ViewRefImpl } from "@/core/abstractions/view-ref";
import { ChangeDetectorRefImpl } from "@/core/abstractions/change-detector-ref";

export abstract class ViewContainerRef {
  abstract readonly element: ElementRef;
  abstract clear(): void;
  abstract get(index: number): ViewRef | null;
  abstract readonly length: number;
  abstract createEmbeddedView<C>(
    templateRef: TemplateRef<C>,
    context?: C,
    options?: { index?: number },
  ): EmbeddedViewRef<C>;
  abstract createEmbeddedView<C>(
    templateRef: TemplateRef<C>,
    context?: C,
    index?: number,
  ): EmbeddedViewRef<C>;
  abstract insert(viewRef: ViewRef, index?: number): ViewRef;
  abstract move(viewRef: ViewRef, currentIndex: number): ViewRef;
  abstract indexOf(viewRef: ViewRef): number;
  abstract remove(index?: number): void;
  abstract detach(index?: number): ViewRef | null;
  abstract createComponent<C>(
    componentType: string,
    options?: {
      index?: number;
      injector?: angular.auto.IInjectorService;
      projectableNodes?: Node[][];
      directives?: string[];
      bindings?: Binding;
    },
  ): ComponentRef<C>;
}

export class ViewContainerRefImpl extends ViewContainerRef {
  private static readonly owners = new WeakMap<ViewRef, ViewContainerRefImpl>();
  private readonly rootNodesByView = new WeakMap<ViewRef, Node[]>();
  private readonly views: ViewRef[] = [];
  private readonly trackedViews = new WeakSet<ViewRef>();

  private injector: angular.auto.IInjectorService;

  constructor(public readonly element: ElementRefImpl) {
    super();

    this.injector = this.getClosestInjector();
  }

  private getClosestInjector() {
    let node = this.element.nativeElement;

    while (node) {
      const injector = angular.element(node).injector();
      if (injector) return injector;

      node = node.parentNode;
    }

    return angular.element(document.body).injector();
  }

  public get length() {
    return this.views.length;
  }

  clear(): void {
    while (this.length) this.remove(this.length - 1);
  }

  createComponent<C>(
    componentType: string,
    options?: {
      index?: number;
      injector?: angular.auto.IInjectorService;
      projectableNodes?: Node[][];
      directives?: string[];
      bindings?: Binding;
    },
  ): ComponentRef<C> {
    const inj = options?.injector ?? this.injector;
    const $compile = inj.get("$compile");
    const rootScop = inj.get("$rootScope");

    const $scope = rootScop.$new(true);

    const componentName = this.toKebabCase(componentType);
    const bindingsAttrs = this._buildBindingsAttrs(options?.bindings ?? {});
    const directivesAttrs = (options?.directives ?? []).map((directive) => this.toKebabCase(directive)).join(" ");
    const attrs = [bindingsAttrs, directivesAttrs].filter(Boolean).join(" ");
    const template = attrs ? `<${componentName} ${attrs}></${componentName}>` : `<${componentName}></${componentName}>`;
    const linkFn = $compile(template);

    angular.extend($scope, options?.bindings);

    const compiled = linkFn($scope);

    const viewRef = new ViewRefImpl($scope);
    const rootNodes = Array.from(compiled);
    const location = new ElementRefImpl(compiled[0]);
    const instance = compiled.controller(componentType);
    const changeDetectorRef = new ChangeDetectorRefImpl($scope);

    this.rootNodesByView.set(viewRef, rootNodes);
    this.insert(viewRef, options?.index);

    return new ComponentRefImpl(location, instance, changeDetectorRef, viewRef);
  }

  private toKebabCase(value: string): string {
    return value
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
      .toLowerCase();
  }

  private _buildBindingsAttrs(bindings: Binding) {
    return Object.keys(bindings || {})
      .map((key) => `${this.toKebabCase(key)}="${key}"`)
      .join(" ");
  }

  createEmbeddedView<C>(
    templateRef: TemplateRef<C>,
    context?: C | undefined,
    options?: { index?: number | undefined } | undefined,
  ): EmbeddedViewRefImpl<C>;

  createEmbeddedView<C>(
    templateRef: TemplateRef<C>,
    context?: C | undefined,
    index?: number | undefined,
  ): EmbeddedViewRefImpl<C>;

  createEmbeddedView<C>(
    templateRef: TemplateRef<C>,
    context?: C,
    options?: { index?: number | undefined } | undefined | number,
  ): EmbeddedViewRefImpl<C> {
    const viewRef = templateRef.createEmbeddedView(context ?? ({} as C));

    const index = typeof options === "number" ? options : options?.index;

    try {
      this.insert(viewRef, index);
    } catch (error) {
      viewRef.destroy();
      throw error;
    }

    return viewRef;
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

    const currentOwner = ViewContainerRefImpl.owners.get(viewRef);
    if (currentOwner) {
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
    ViewContainerRefImpl.owners.set(viewRef, this);
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

    if (ViewContainerRefImpl.owners.get(viewRef) === this) {
      ViewContainerRefImpl.owners.delete(viewRef);
    }

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
    const rootNodes = this.rootNodesByView.get(viewRef) ?? (viewRef as Partial<EmbeddedViewRefImpl>).rootNodes;

    if (!rootNodes) {
      throw new Error("La vista no expone rootNodes y no puede insertarse");
    }

    return rootNodes as Node[];
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

  private trackDestroyedView(viewRef: ViewRef) {
    if (this.trackedViews.has(viewRef)) return;

    this.trackedViews.add(viewRef);
    viewRef.onDestroy(() => {
      const index = this.views.indexOf(viewRef);
      if (index !== -1) this.views.splice(index, 1);

      if (ViewContainerRefImpl.owners.get(viewRef) === this) {
        ViewContainerRefImpl.owners.delete(viewRef);
      }
    });
  }
}
