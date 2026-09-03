import type angular from "angular";
import type { ICompileService, IPromise, IQService, IRootScopeService, ITimeoutService } from "angular";
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

export function createComponent<C>(component: string, options: CreateComponentOptions): IPromise<ComponentRef<C>> {
  const injector = options.elementInjector ?? options.environmentInjector;
  const $q = injector.get<IQService>("$q");
  const linkedComponent = linkComponent(component, options);
  const instance = linkedComponent.linkedElement.controller(component) as C | undefined;

  if (instance) return $q.when(createComponentRef(instance, linkedComponent));

  const $timeout = injector.get<ITimeoutService>("$timeout");

  return waitForComponentController<C>(linkedComponent.linkedElement, component, $q, $timeout).then(
    (instance) => createComponentRef(instance, linkedComponent),
    (error) => {
      linkedComponent.ownerScope.$destroy();
      return $q.reject(error);
    },
  );
}

interface LinkedComponent {
  bindings: Binding;
  hostElement: Element;
  linkedElement: angular.IAugmentedJQuery;
  ownerScope: angular.IScope;
}

function linkComponent(component: string, options: CreateComponentOptions): LinkedComponent {
  const injector = options.elementInjector ?? options.environmentInjector;
  const $compile = injector.get<ICompileService>("$compile");
  const $rootScope = injector.get<IRootScopeService>("$rootScope");
  const ownerScope = $rootScope.$new(true);
  const bindings = normalizeBindings(options.bindings);
  const componentName = toKebabCase(component);
  const requestedHost = options.hostElement ?? document.createElement(componentName);
  const hostElement = resolveComponentHost(requestedHost, componentName);

  Object.assign(ownerScope, bindings);
  applyHostAttributes(hostElement, bindings, options.directives ?? [], component, injector);
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

  return { bindings, hostElement, linkedElement, ownerScope };
}

function createComponentRef<C>(instance: C, linkedComponent: LinkedComponent): ComponentRef<C> {
  const { bindings, hostElement, linkedElement, ownerScope } = linkedComponent;

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

function waitForComponentController<C>(
  linkedElement: angular.IAugmentedJQuery,
  component: string,
  $q: IQService,
  $timeout: ITimeoutService,
): IPromise<C> {
  const timeoutAt = Date.now() + 10_000;
  const deferred = $q.defer<C>();

  const check = () => {
    const instance = linkedElement.controller(component) as C | undefined;
    if (instance) {
      deferred.resolve(instance);
      return;
    }

    if (Date.now() >= timeoutAt) {
      deferred.reject(new Error(`No se pudo crear el componente "${component}"`));
      return;
    }

    $timeout(check, 0, false);
  };

  check();
  return deferred.promise;
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

function applyHostAttributes(
  host: Element,
  bindings: Binding,
  directives: string[],
  component: string,
  injector: angular.auto.IInjectorService,
): void {
  const componentBindings = resolveComponentBindings(component, injector);

  for (const key of Object.keys(bindings)) {
    const binding = componentBindings[key];
    const mode = typeof binding === "string" ? binding[0] : binding?.mode;
    host.setAttribute(toKebabCase(key), mode === "@" ? `{{${key}}}` : key);
  }

  for (const directive of directives) host.setAttribute(toKebabCase(directive), "");
}

function resolveComponentBindings(
  component: string,
  injector: angular.auto.IInjectorService,
): Record<string, string | { mode?: string }> {
  try {
    const [definition] = injector.get<Array<{ bindToController?: Record<string, string | { mode?: string }> }>>(
      `${component}Directive`,
    );
    return definition?.bindToController ?? {};
  } catch {
    return {};
  }
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
