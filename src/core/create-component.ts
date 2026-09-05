import type angular from "angular";
import type { ICompileService, IPromise, IQService, IRootScopeService, ITimeoutService } from "angular";
import { ChangeDetectorRefImpl } from "@/core/change-detection/change-detector-ref.ts";
import type { ComponentDef } from "@/core/metadata/def.ts";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import { ComponentRef, ComponentRefImpl } from "@/core/refs/component-ref.ts";
import { ElementRefImpl } from "@/core/refs/element-ref.ts";
import { ViewRefImpl } from "@/core/refs/view-ref.ts";
import { ConfigProviderFactory } from "@/platform/config-providers.ts";

type Bindings = Readonly<Record<string, unknown>>;

export interface CreateComponentOptions {
  injector?: angular.auto.IInjectorService;
  environmentInjector?: angular.auto.IInjectorService;
  elementInjector?: angular.auto.IInjectorService;
  hostElement?: Element;
  projectableNodes?: Node[][];
  directives?: string[];
  bindings?: Bindings | readonly Bindings[];
}

type StampedDef = ComponentDef & { inputs: readonly { bindingName: string; twoWay?: boolean }[]; outputs: readonly { bindingName: string }[] };

interface ComponentLinkDef extends Partial<StampedDef> {
  selector: string;
  controllerName: string;
  bindingModes?: Record<string, string | { mode?: string }>;
}

export function createComponent<C = unknown>(component: Function | string, options: CreateComponentOptions): IPromise<ComponentRef<C>> {
  const injector = resolveInjector(options);
  const $q = injector.get<IQService>("$q");
  const def = typeof component === "string" ? stringComponentDef(component, injector) : classComponentDef(component, injector);

  const linked = linkComponent(def, options);
  const instance = linked.linkedElement.controller(def.controllerName) as C | undefined;

  if (instance !== undefined) return $q.when(createComponentRef(instance, linked));

  const $timeout = injector.get<ITimeoutService>("$timeout");
  return waitForComponentController<C>(linked.linkedElement, def.controllerName, $q, $timeout).then(
    (resolvedInstance) => createComponentRef(resolvedInstance, linked),
    (error: unknown) => {
      linked.ownerScope.$destroy();
      return $q.reject(error);
    },
  );
}

function resolveInjector(options: CreateComponentOptions): angular.auto.IInjectorService {
  const injector = options.elementInjector ?? options.injector ?? options.environmentInjector;
  if (!injector) throw new Error("createComponent: falta injector/environmentInjector");
  return injector;
}

function classComponentDef(Clase: Function, injector: angular.auto.IInjectorService): ComponentLinkDef {
  const def = requireComponentDef(Clase);
  ensureRegistered(Clase, def, injector);
  return { ...def, controllerName: def.selector };
}

function stringComponentDef(component: string, injector: angular.auto.IInjectorService): ComponentLinkDef {
  return {
    selector: toKebabCase(component),
    controllerName: component,
    bindingModes: resolveComponentBindings(component, injector),
  };
}

function requireComponentDef(Clase: Function): StampedDef {
  const def = getComponentDef(Clase) as StampedDef | undefined;
  if (!def) throw new Error("createComponent: la clase no tiene @Component/component().define() - no hay selector");
  return def;
}

function ensureRegistered(Clase: Function, def: StampedDef, injector: angular.auto.IInjectorService): void {
  const registrationName = toCamelCase(def.selector);
  if (injector.has(`${registrationName}Directive`)) return;

  const registrar = ConfigProviderFactory.current;
  if (!registrar) {
    throw new Error(
      `createComponent: "${def.selector}" no esta registrado y no hay providers de .config() capturados para registrarlo ahora`,
    );
  }

  registrar.$compile.component(registrationName, {
    controller: Clase as unknown as angular.Injectable<angular.IControllerConstructor>,
    template: def.template,
    templateUrl: def.templateUrl,
    bindings: computeBindings(def),
  });
}

function computeBindings(def: StampedDef): Record<string, string> {
  const bindings: Record<string, string> = {};
  for (const input of def.inputs) bindings[input.bindingName] = input.twoWay ? "=" : "<";
  for (const output of def.outputs) bindings[output.bindingName] = "&";
  return bindings;
}

interface LinkedComponent {
  bindings: Record<string, unknown>;
  hostElement: Element;
  linkedElement: angular.IAugmentedJQuery;
  ownerScope: angular.IScope;
}

function linkComponent(def: ComponentLinkDef, options: CreateComponentOptions): LinkedComponent {
  const injector = resolveInjector(options);
  const $compile = injector.get<ICompileService>("$compile");
  const $rootScope = injector.get<IRootScopeService>("$rootScope");
  const ownerScope = $rootScope.$new(true);
  const bindings = normalizeBindings(options.bindings);
  const requestedHost = options.hostElement ?? document.createElement(def.selector);
  const hostElement = resolveComponentHost(requestedHost, def.selector);

  Object.assign(ownerScope, bindings);
  applyHostAttributes(hostElement, bindings, options.directives ?? [], def.bindingModes);
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

function createComponentRef<C>(instance: C, linked: LinkedComponent): ComponentRef<C> {
  const { hostElement, linkedElement, ownerScope, bindings } = linked;
  const rootNodes = Array.from(linkedElement) as Node[];
  const hostView = new ViewRefImpl(ownerScope, rootNodes);

  hostView.detach();

  return new ComponentRefImpl(
    new ElementRefImpl((rootNodes[0] ?? hostElement) as HTMLElement),
    instance,
    new ChangeDetectorRefImpl(ownerScope),
    hostView,
    bindings,
  );
}

function waitForComponentController<C>(
  linkedElement: angular.IAugmentedJQuery,
  controllerName: string,
  $q: IQService,
  $timeout: ITimeoutService,
): IPromise<C> {
  const timeoutAt = Date.now() + 10_000;
  const deferred = $q.defer<C>();

  const check = () => {
    const instance = linkedElement.controller(controllerName) as C | undefined;
    if (instance !== undefined) {
      deferred.resolve(instance);
      return;
    }

    if (Date.now() >= timeoutAt) {
      deferred.reject(new Error(`createComponent: no se pudo crear el componente "${controllerName}"`));
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

function normalizeBindings(bindings?: CreateComponentOptions["bindings"]): Record<string, unknown> {
  if (!bindings) return {};
  return Array.isArray(bindings) ? Object.assign({}, ...bindings) : { ...bindings };
}

function applyHostAttributes(
  host: Element,
  bindings: Record<string, unknown>,
  directives: string[],
  bindingModes?: Record<string, string | { mode?: string }>,
): void {
  for (const key of Object.keys(bindings)) {
    const binding = bindingModes?.[key];
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

function resolveComponentHost(requestedHost: Element, selector: string): Element {
  if (requestedHost.localName === selector) return requestedHost;

  const componentHost = document.createElement(selector);
  requestedHost.replaceChildren(componentHost);
  return componentHost;
}

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function toCamelCase(value: string): string {
  return value.replace(/-([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}
