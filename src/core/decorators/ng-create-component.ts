import type angular from "angular";
import type { ICompileService, IRootScopeService } from "angular";
import type { Binding } from "@/core";
import { type ComponentRef, ComponentRefImpl } from "@/core/abstractions/component-ref";
import { ElementRefImpl } from "@/core/abstractions/element-ref";
import { ViewRefImpl } from "@/core/abstractions/view-ref";

export interface CreateComponentOptions {
  environmentInjector: angular.auto.IInjectorService;
  elementInjector?: angular.auto.IInjectorService;
  hostElement?: Element;
  projectableNodes?: Node[][];
  directives?: string[];
  bindings?: Binding | Binding[];
}

declare global {
  function createComponent<C>(component: string, options: CreateComponentOptions): ComponentRef<C>;
}

export function createComponent<C>(component: string, options: CreateComponentOptions): ComponentRef<C> {
  const injector = options.elementInjector ?? options.environmentInjector;
  const $compile = injector.get<ICompileService>("$compile");
  const $rootScope = injector.get<IRootScopeService>("$rootScope");
  const ownerScope = $rootScope.$new(true);
  const bindings = normalizeBindings(options.bindings);
  const componentName = toKebabCase(component);
  const requestedHost = options.hostElement ?? document.createElement(componentName);
  const hostElement = resolveComponentHost(requestedHost, componentName);

  Object.assign(ownerScope, bindings);
  applyHostAttributes(hostElement, bindings, options.directives ?? []);
  const projectableNodes = options.projectableNodes ?? [];
  appendProjectionMarkers(hostElement, projectableNodes);

  let linkedElement: angular.IAugmentedJQuery;
  try {
    linkedElement = $compile(hostElement)(ownerScope);
    if (projectableNodes.length) projectNodes(hostElement, projectableNodes);
  } catch (error) {
    ownerScope.$destroy();
    throw error;
  }

  const instance = linkedElement.controller(component) as C | undefined;

  if (!instance) {
    ownerScope.$destroy();
    throw new Error(`No se pudo crear el componente "${component}"`);
  }

  const rootNodes = Array.from(linkedElement);
  const hostView = new ViewRefImpl(ownerScope, rootNodes);

  hostView.detach();

  return new ComponentRefImpl(
    new ElementRefImpl((rootNodes[0] ?? hostElement) as HTMLElement),
    instance,
    hostView,
    hostView,
    bindings,
  );
}

const PROJECTABLE_NODE_ATTRIBUTE = "data-ngjs-projectable-node";

function appendProjectionMarkers(host: Element, projectableNodes: Node[][]): void {
  projectableNodes.forEach((_, index) => {
    const marker = document.createElement("ngjs-projectable-node");
    marker.setAttribute(PROJECTABLE_NODE_ATTRIBUTE, String(index));
    host.append(marker);
  });
}

function projectNodes(host: Element, projectableNodes: Node[][]): void {
  const projectedSlots = new Set<number>();
  const markers = Array.from(host.querySelectorAll(`[${PROJECTABLE_NODE_ATTRIBUTE}]`));

  for (const marker of markers) {
    const index = Number(marker.getAttribute(PROJECTABLE_NODE_ATTRIBUTE));
    const parent = marker.parentNode;

    if (parent && !projectedSlots.has(index)) {
      for (const node of projectableNodes[index] ?? []) parent.insertBefore(node, marker);
      projectedSlots.add(index);
    }

    parent?.removeChild(marker);
  }

  projectableNodes.forEach((nodes, index) => {
    if (!projectedSlots.has(index)) host.append(...nodes);
  });
}

function normalizeBindings(bindings?: Binding | Binding[]): Binding {
  if (!bindings) return {};
  return Array.isArray(bindings) ? Object.assign({}, ...bindings) : bindings;
}

function applyHostAttributes(host: Element, bindings: Binding, directives: string[]): void {
  for (const key of Object.keys(bindings)) host.setAttribute(toKebabCase(key), key);
  for (const directive of directives) host.setAttribute(toKebabCase(directive), "");
}

function resolveComponentHost(requestedHost: Element, componentName: string): Element {
  if (requestedHost.localName === componentName) return requestedHost;

  const componentHost = document.createElement(componentName);
  requestedHost.replaceChildren(componentHost);
  return componentHost;
}

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

globalThis.createComponent = createComponent;
