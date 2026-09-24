import angular, {
  type ICompileService,
  type IPromise,
  type IQService,
  type IRootScopeService,
  type ITimeoutService,
} from "angular";
import { ChangeDetectorRefImpl } from "@/core/change-detection/change-detector-ref.ts";
import { Injector, unwrapAngularInjector } from "@/core/di/injector.ts";
import { CompiledType } from "@/core/metadata/compiled-type.ts";
import { ComponentRegistrar } from "@/core/platform/component-registrar.ts";
import { type ComponentRef, ComponentRefImpl } from "@/core/refs/component-ref.ts";
import { ElementRefImpl } from "@/core/refs/element-ref.ts";
import { ViewRefImpl } from "@/core/refs/view-ref.ts";

type Bindings = Readonly<Record<string, unknown>>;

type AnyInjector = angular.auto.IInjectorService | Injector;

/** jqLite `data()` del injector por elemento que emite `ng-js-compiler`. */
const SCOPED_INJECTOR_DATA_KEY = "$ngjsScopedInjector";

export interface CreateComponentOptions {
  /** `$injector` nativo o `Injector` público. */
  injector?: AnyInjector;
  environmentInjector?: AnyInjector;
  elementInjector?: AnyInjector;
  /**
   * Interno (`ViewContainerRef`): el elemento del contenedor. El componente hereda su injector por elemento (los
   * `providers` de los componentes que lo contienen), como el `parentInjector` del contenedor en Angular.
   */
  ɵparentElement?: Element;
  hostElement?: Element;
  projectableNodes?: Node[][];
  directives?: string[];
  /** Valores iniciales de los inputs, por nombre de propiedad. */
  bindings?: Bindings | readonly Bindings[];
}

/** Cómo se enlaza: tag, nombre de registro (clave del controller) y el `bindings` crudo de AngularJS. */
interface ComponentTarget {
  tag: string;
  controllerName: string;
  /** `{ propiedad: "<?alias" }` — lo que registró `.component()`. */
  bindings: Record<string, string>;
}

interface LinkedComponent {
  bindings: Record<string, unknown>;
  hostElement: Element;
  linkedElement: angular.IAugmentedJQuery;
  ownerScope: angular.IScope;
}

/**
 * `createComponent()` de Angular sobre `$compile`: crea el host del componente (si no está declarado en un
 * `@NgModule` cargado — un chunk lazy — se registra al vuelo con su `ɵcmp.definition`), lo enlaza contra un scope propio con los
 * `bindings` iniciales y devuelve un `ComponentRef`. `component` también puede ser el nombre de registro de un
 * componente AngularJS legacy.
 */
export function createComponent<C = unknown>(
  component: Function | string,
  options: CreateComponentOptions,
): IPromise<ComponentRef<C>> {
  const injector = ComponentCreation.injectorOf(options);
  const $q = injector.get<IQService>("$q");
  let target: ComponentTarget;
  let linked: LinkedComponent;
  try {
    target = ComponentCreation.target(component, injector);
    linked = ComponentCreation.link(target, options, injector);
  } catch (error) {
    return $q.reject(error);
  }

  const instance = linked.linkedElement.controller(target.controllerName) as C | undefined;
  if (instance !== undefined) return $q.when(ComponentCreation.ref(instance, linked));

  // `templateUrl`: AngularJS construye el controller recién cuando llega el template.
  return ComponentCreation.waitForController<C>(linked.linkedElement, target.controllerName, injector).then(
    (resolved) => ComponentCreation.ref(resolved, linked),
    (error: unknown) => {
      linked.ownerScope.$destroy();
      return $q.reject(error);
    },
  );
}

class ComponentCreation {
  private static readonly PROJECTABLE_NODE_ATTRIBUTE = "data-ngjs-projectable-node";

  static injectorOf(options: CreateComponentOptions): angular.auto.IInjectorService {
    const injector = options.elementInjector ?? options.injector ?? options.environmentInjector;
    if (!injector) throw new Error("createComponent: falta injector/environmentInjector");
    return injector instanceof Injector ? unwrapAngularInjector(injector) : injector;
  }

  static target(component: Function | string, injector: angular.auto.IInjectorService): ComponentTarget {
    if (typeof component === "string") {
      return {
        tag: ComponentCreation.kebabCase(component),
        controllerName: component,
        bindings: ComponentCreation.registeredBindings(component, injector),
      };
    }

    const tag = CompiledType.componentTag(component);
    if (!tag)
      throw new Error(`createComponent: "${component.name}" no es un @Component compilado con selector de elemento.`);
    // Declarado en un módulo cargado, o (un componente de un chunk lazy que no está en ninguno) registrado al vuelo.
    const controllerName = ComponentRegistrar.ensure(component, injector);
    return { tag, controllerName, bindings: ComponentCreation.registeredBindings(controllerName, injector) };
  }

  /** El `bindings` con que se registró el componente (`.component(name, { bindings })`). */
  private static registeredBindings(name: string, injector: angular.auto.IInjectorService): Record<string, string> {
    if (!injector.has(`${name}Directive`)) return {};
    const [definition] = injector.get<{ bindToController?: unknown }[]>(`${name}Directive`);
    const raw = definition?.bindToController;
    return raw && typeof raw === "object" ? (raw as Record<string, string>) : {};
  }

  static link(
    target: ComponentTarget,
    options: CreateComponentOptions,
    injector: angular.auto.IInjectorService,
  ): LinkedComponent {
    const $compile = injector.get<ICompileService>("$compile");
    const $rootScope = injector.get<IRootScopeService>("$rootScope");
    const ownerScope = $rootScope.$new(true);
    const bindings = ComponentCreation.normalizeBindings(options.bindings);
    const hostElement = ComponentCreation.host(options.hostElement ?? document.createElement(target.tag), target.tag);

    Object.assign(ownerScope, bindings);
    // Se enlaza suelto (fuera del DOM del contenedor): el injector por elemento del contenedor se le pasa a mano.
    const containerInjector =
      options.ɵparentElement && angular.element(options.ɵparentElement).inheritedData(SCOPED_INJECTOR_DATA_KEY);
    if (containerInjector) angular.element(hostElement).data(SCOPED_INJECTOR_DATA_KEY, containerInjector);
    ComponentCreation.applyHostAttributes(hostElement, bindings, options.directives ?? [], target.bindings);
    const projectableNodes = options.projectableNodes ?? [];
    ComponentCreation.appendProjectionMarkers(hostElement, projectableNodes);

    try {
      const linkedElement = $compile(hostElement)(ownerScope);
      if (projectableNodes.length) ComponentCreation.projectNodes(hostElement, projectableNodes);
      return { bindings, hostElement, linkedElement, ownerScope };
    } catch (error) {
      ownerScope.$destroy();
      throw error;
    }
  }

  static ref<C>(instance: C, linked: LinkedComponent): ComponentRef<C> {
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

  static waitForController<C>(
    linkedElement: angular.IAugmentedJQuery,
    controllerName: string,
    injector: angular.auto.IInjectorService,
  ): IPromise<C> {
    const $q = injector.get<IQService>("$q");
    const $timeout = injector.get<ITimeoutService>("$timeout");
    const timeoutAt = Date.now() + 10_000;
    const deferred = $q.defer<C>();

    const check = () => {
      const instance = linkedElement.controller(controllerName) as C | undefined;
      if (instance !== undefined) return deferred.resolve(instance);
      if (Date.now() >= timeoutAt) {
        return deferred.reject(new Error(`createComponent: no se pudo crear el componente "${controllerName}"`));
      }
      $timeout(check, 0, false);
    };

    check();
    return deferred.promise;
  }

  /** Cada binding inicial como atributo del host: el nombre del atributo (el alias, si lo hay) y su modo. */
  private static applyHostAttributes(
    host: Element,
    bindings: Record<string, unknown>,
    directives: string[],
    registered: Record<string, string>,
  ): void {
    for (const key of Object.keys(bindings)) {
      const [, mode = "<", alias = ""] = /^([<@&=])\??(\w*)$/.exec(registered[key] ?? "") ?? [];
      host.setAttribute(ComponentCreation.kebabCase(alias || key), mode === "@" ? `{{${key}}}` : key);
    }
    for (const directive of directives) host.setAttribute(ComponentCreation.kebabCase(directive), "");
  }

  private static appendProjectionMarkers(host: Element, projectableNodes: Node[][]): void {
    projectableNodes.forEach((_, index) => {
      const marker = document.createElement("ngjs-projectable-node");
      marker.setAttribute(ComponentCreation.PROJECTABLE_NODE_ATTRIBUTE, String(index));
      host.append(marker);
    });
  }

  private static projectNodes(host: Element, projectableNodes: Node[][]): void {
    const projected = new Set<number>();
    for (const marker of Array.from(host.querySelectorAll(`[${ComponentCreation.PROJECTABLE_NODE_ATTRIBUTE}]`))) {
      const index = Number(marker.getAttribute(ComponentCreation.PROJECTABLE_NODE_ATTRIBUTE));
      const parent = marker.parentNode;
      if (parent && !projected.has(index)) {
        for (const node of projectableNodes[index] ?? []) parent.insertBefore(node, marker);
        projected.add(index);
      }
      parent?.removeChild(marker);
    }
    projectableNodes.forEach((nodes, index) => {
      if (!projected.has(index)) host.append(...nodes);
    });
  }

  private static normalizeBindings(bindings?: CreateComponentOptions["bindings"]): Record<string, unknown> {
    if (!bindings) return {};
    return Array.isArray(bindings) ? Object.assign({}, ...bindings) : { ...(bindings as Bindings) };
  }

  /** El host tiene que ser el tag del componente; si se pidió otro elemento, el componente va adentro. */
  private static host(requested: Element, tag: string): Element {
    if (requested.localName === tag) return requested;
    const componentHost = document.createElement(tag);
    requested.replaceChildren(componentHost);
    return componentHost;
  }

  private static kebabCase(value: string): string {
    return value
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
      .toLowerCase();
  }

}
