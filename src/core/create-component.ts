import type angular from "angular";
import type { ICompileService, IPromise, IQService, IRootScopeService, ITimeoutService } from "angular";
import { ChangeDetectorRefImpl } from "@/core/change-detection/change-detector-ref.ts";
import type { ComponentDef } from "@/core/metadata/def.ts";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import { ComponentRef, ComponentRefImpl } from "@/core/refs/component-ref.ts";
import { ElementRefImpl } from "@/core/refs/element-ref.ts";
import { ViewRefImpl } from "@/core/refs/view-ref.ts";
import { ConfigProviderFactory } from "@/platform/config-providers.ts";

export interface CreateComponentOptions {
  /** Injector desde donde resolver `$compile`/`$q`/`$rootScope`/`$timeout` — normalmente el `$injector` de la app ya bootstrapeada. */
  injector: angular.auto.IInjectorService;
  hostElement?: Element;
  projectableNodes?: Node[][];
  directives?: string[];
  bindings?: Readonly<Record<string, unknown>>;
}

type StampedDef = ComponentDef & { inputs: readonly { bindingName: string; twoWay?: boolean }[]; outputs: readonly { bindingName: string }[] };

/**
 * Acepta la CLASE (`@Component` recién importada, ej. vía `import()` de un
 * chunk lazy) — no un string como en `reference/`. Si no está registrada
 * todavía en AngularJS, la registra sola vía `ConfigProviderFactory.current`
 * (mismo mecanismo que el chunk lazy de etapa 2, ver `bootstrap.test.ts`),
 * derivando `bindings` de `getComponentDef(Clase).inputs`/`.outputs`.
 */
export function createComponent<C = unknown>(Clase: Function, options: CreateComponentOptions): IPromise<ComponentRef<C>> {
  const { injector } = options;
  const $q = injector.get<IQService>("$q");
  const def = requireComponentDef(Clase);

  ensureRegistered(Clase, def, injector);
  const linked = linkComponent(def, options);
  const instance = linked.linkedElement.controller(def.selector) as C | undefined;

  if (instance !== undefined) return $q.when(createComponentRef(instance, linked));

  const $timeout = injector.get<ITimeoutService>("$timeout");
  return waitForComponentController<C>(linked.linkedElement, def.selector, $q, $timeout).then(
    (resolvedInstance) => createComponentRef(resolvedInstance, linked),
    (error) => {
      linked.ownerScope.$destroy();
      return $q.reject(error);
    },
  );
}

function requireComponentDef(Clase: Function): StampedDef {
  const def = getComponentDef(Clase) as StampedDef | undefined;
  if (!def) throw new Error("createComponent: la clase no tiene @Component/component().define() — no hay selector");
  return def;
}

function ensureRegistered(Clase: Function, def: StampedDef, injector: angular.auto.IInjectorService): void {
  // $compile normaliza el tag observado (<my-widget>) a camelCase antes de
  // buscarlo en el injector (myWidgetDirective) — confirmado con un probe
  // real: registrar bajo el string kebab-case literal no matchea nada.
  const registrationName = toCamelCase(def.selector);
  if (injector.has(`${registrationName}Directive`)) return;

  const registrar = ConfigProviderFactory.current;
  if (!registrar) {
    throw new Error(
      `createComponent: "${def.selector}" no está registrado y no hay providers de .config() capturados para registrarlo ahora`,
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
  selector: string;
  bindings: Record<string, unknown>;
  hostElement: Element;
  linkedElement: angular.IAugmentedJQuery;
  ownerScope: angular.IScope;
}

function linkComponent(def: StampedDef, options: CreateComponentOptions): LinkedComponent {
  const { injector } = options;
  const selector = def.selector;
  const $compile = injector.get<ICompileService>("$compile");
  const $rootScope = injector.get<IRootScopeService>("$rootScope");
  const ownerScope = $rootScope.$new(true);
  const bindings = { ...(options.bindings ?? {}) };
  const requestedHost = options.hostElement ?? document.createElement(def.selector);
  const hostElement = resolveComponentHost(requestedHost, def.selector);

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

  return { selector, bindings, hostElement, linkedElement, ownerScope };
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
  selector: string,
  $q: IQService,
  $timeout: ITimeoutService,
): IPromise<C> {
  const timeoutAt = Date.now() + 10_000;
  const deferred = $q.defer<C>();

  const check = () => {
    const instance = linkedElement.controller(selector) as C | undefined;
    if (instance !== undefined) {
      deferred.resolve(instance);
      return;
    }

    if (Date.now() >= timeoutAt) {
      deferred.reject(new Error(`createComponent: no se pudo crear el componente "${selector}"`));
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

/**
 * Todo binding nuestro es de expresión (`<`/`=`, nunca `@` — no hay un modo
 * "string interpolado" separado en `InputDef`), así que el atributo siempre
 * es el NOMBRE de la propiedad del scope (`Object.assign(ownerScope, ...)`
 * ya puso el valor ahí) — nunca `{{...}}` interpolado.
 */
function applyHostAttributes(host: Element, bindings: Record<string, unknown>, directives: string[]): void {
  for (const key of Object.keys(bindings)) {
    host.setAttribute(toKebabCase(key), key);
  }
  for (const directive of directives) host.setAttribute(toKebabCase(directive), "");
}

function resolveComponentHost(requestedHost: Element, selector: string): Element {
  if (requestedHost.localName === selector) return requestedHost;

  const componentHost = document.createElement(selector);
  requestedHost.replaceChildren(componentHost);
  return componentHost;
}

function toKebabCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function toCamelCase(value: string): string {
  return value.replace(/-([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}
