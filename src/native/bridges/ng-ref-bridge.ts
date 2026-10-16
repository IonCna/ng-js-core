import type angular from "angular";
import { CompiledType } from "@/core/metadata/compiled-type.ts";
import { Query } from "@/core/queries/query.ts";
import { QueryContext } from "@/core/queries/query-context.ts";
import { ViewQueryRegistry } from "@/core/queries/view-query-registry.ts";
import { ElementRefImpl } from "@/core/refs/element-ref.ts";
import type { TemplateRef } from "@/core/refs/template-ref.ts";
import { ElementTokens } from "@/native/bridges/element-tokens-bridge.ts";
import { decorateControllerWith, prependInstanceMethod } from "@/native/bridges/shared.ts";

/**
 * Por cada controller instanciado: arma su `ViewQueryRegistry` con las queries de su definición compilada
 * (`ɵcmp`/`ɵdir.queries`/`viewQueries`) — el campo pasa a ser un getter del resultado; una query sobre un setter
 * recibe cada resultado por el setter —, se publica como candidato (de vista en los registries de los scopes
 * ancestros; de contenido en los dueños que bindeó la proyección) y engancha `resolve()` al `$postLink`, cuando
 * ya se publicaron todos los hijos.
 */
export function decorateControllerViewChildQueries(
  $delegate: angular.IControllerService,
  $injector: angular.auto.IInjectorService,
): angular.IControllerService {
  return decorateControllerWith($delegate, {
    onInstance: (instance, locals) => {
      if (!instance || typeof instance !== "object") return;

      const $scope = locals?.$scope as angular.IScope | undefined;
      const $element = locals?.$element as angular.IAugmentedJQuery | undefined;
      const node = $element?.[0] as Node | undefined;
      const type = CompiledType.ofInstance(instance);
      const registry = new ViewQueryRegistry();
      registry.injector = $injector;
      // Una `@Directive` (no `@Component`) proyecta light DOM: sus queries de contenido matchean descendientes del
      // host sin `<ng-content>` de por medio. Un `@Component` no: su contenido va por `<ng-content>`.
      if (node && !CompiledType.isComponent(type) && CompiledType.def(type)) registry.hostNode = node;
      if (node && CompiledType.isComponent(type)) registry.componentNode = node;

      const setterQueries = QueryInstaller.install(instance, CompiledType.def(type), registry);
      // Un `@ViewChild`/`@ContentChild` sobre setter lo recibe solo cuando el resultado cambió (como en Angular: la
      // query no está "dirty" si entró o salió otro candidato); un `QueryList` se reasigna en cada resolve.
      const assigned = new Map<Query, unknown>();
      const resolve = () => {
        registry.resolve();
        for (const { propertyName, query } of setterQueries) {
          if (query.def.first && assigned.has(query) && assigned.get(query) === query.value) continue;
          assigned.set(query, query.value);
          (instance as Record<string, unknown>)[propertyName] = query.value;
        }
      };

      if ($scope) {
        QueryContext.registerScopeRegistry($scope, registry);
        // Re-resolver (coalescido dentro del digest) cuando el contenido cambia después del primer `resolve()` —
        // así el `QueryList` emite en `.changes`.
        let pending = false;
        registry.onDynamicChange = () => {
          if (pending) return;
          pending = true;
          $scope.$evalAsync(() => {
            pending = false;
            resolve();
          });
        };
        CandidatePublisher.publish(instance, $scope, node, registry);
        $scope.$on("$destroy", () => registry.destroy());
      }

      // Antes del `$postLink` del autor (donde corren `ngAfterContentInit`/`ngAfterViewInit`): las queries ya
      // resueltas, como en Angular.
      prependInstanceMethod(instance, "$postLink", resolve);
    },
  });
}
decorateControllerViewChildQueries.$inject = ["$delegate", "$injector"];

class QueryInstaller {
  /** Instala las queries de `def` en `instance`; devuelve las que van por setter (se asignan en cada resolve). */
  static install(
    instance: object,
    def: ReturnType<typeof CompiledType.def>,
    registry: ViewQueryRegistry,
  ): { propertyName: string; query: Query }[] {
    const setterQueries: { propertyName: string; query: Query }[] = [];
    const register = (queryDef: NonNullable<typeof def>["queries"], content: boolean) => {
      for (const definition of queryDef ?? []) {
        const query = Query.from(definition);
        if (content) registry.registerContentQuery(query);
        else registry.registerViewQuery(query);

        const { propertyName } = definition;
        if (QueryInstaller.hasSetter(instance, propertyName)) {
          setterQueries.push({ propertyName, query });
          continue;
        }
        Object.defineProperty(instance, propertyName, { configurable: true, enumerable: true, get: () => query.value });
      }
    };
    register(def?.queries, true);
    register(def?.viewQueries, false);
    return setterQueries;
  }

  private static hasSetter(instance: object, propertyName: string): boolean {
    for (
      let proto = Object.getPrototypeOf(instance);
      proto && proto !== Object.prototype;
      proto = Object.getPrototypeOf(proto)
    ) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, propertyName);
      if (descriptor) return typeof descriptor.set === "function";
    }
    return false;
  }
}

class CandidatePublisher {
  /** Las clases de la cadena de `instance` (la propia y sus bases): una query por cualquiera de ellas la encuentra. */
  private static tokensOf(instance: object): Function[] {
    const tokens: Function[] = [];
    for (
      let proto = Object.getPrototypeOf(instance);
      proto && proto !== Object.prototype;
      proto = Object.getPrototypeOf(proto)
    ) {
      const ctor = proto.constructor as Function | undefined;
      if (ctor && !tokens.includes(ctor)) tokens.push(ctor);
    }
    return tokens;
  }

  static publish(instance: object, $scope: angular.IScope, node: Node | undefined, own: ViewQueryRegistry): void {
    const tokens = CandidatePublisher.tokensOf(instance);
    const published: ViewQueryRegistry[] = [];

    for (const registry of QueryContext.ancestorRegistries($scope)) {
      registry.registerCandidate(tokens, instance, node);
      published.push(registry);
    }
    for (const owner of QueryContext.contentOwners($scope)) {
      owner.registerContentCandidate(tokens, instance, node);
      published.push(owner);
    }
    // Una directiva en el template de un componente comparte su scope: es de su vista.
    for (const registry of QueryContext.scopeRegistries($scope)) {
      if (registry === own || !registry.containsViewNode(node)) continue;
      registry.registerCandidate(tokens, instance, node);
      published.push(registry);
    }
    // Light DOM: una `@Directive` sin template comparte `$scope` con lo que tiene adentro — se publica como contenido
    // en los registries de ese template (el mismo scope, o uno del que hereda: los hijos de un `ng-repeat`/`ng-if`
    // adentro del host) cuyo host contenga este nodo.
    for (const scope of QueryContext.lexicalScopes($scope)) {
      for (const registry of QueryContext.scopeRegistries(scope)) {
        if (registry === own || !registry.hostNode || !registry.hasContentQueries) continue;
        if (registry.containsLightDomNode(node)) {
          registry.registerContentCandidate(tokens, instance, node);
          published.push(registry);
        }
      }
    }

    // Si el controller se destruye (`ng-if`/`ng-repeat`), sale de donde se publicó y se re-resuelve.
    if (published.length > 0) {
      $scope.$on("$destroy", () => {
        for (const registry of published) registry.removeCandidate(instance);
      });
    }
  }

  /**
   * Un `ng-ref="nombre"` (el `#nombre` de Angular) como candidato con nombre, de vista y de contenido. Devuelve los
   * registries donde quedó publicado, para sacarlo al destruirse su scope.
   * `node` es el elemento que lleva el `ng-ref`, sea cual sea `value`: como en Angular, `read: ElementRef` sobre
   * `#ref` en un componente da su elemento host aunque el valor de la referencia sea la instancia.
   */
  static publishNamed(scope: angular.IScope, locator: string, value: unknown, node: Node): ViewQueryRegistry[] {
    const published: ViewQueryRegistry[] = [];

    for (const registry of [...QueryContext.scopeRegistries(scope), ...QueryContext.ancestorRegistries(scope)]) {
      registry.registerNamedCandidate(locator, value, node);
      published.push(registry);
    }
    for (const owner of QueryContext.contentOwners(scope)) {
      owner.registerNamedContentCandidate(locator, value, node);
      published.push(owner);
    }
    return published;
  }
}

interface NgRefRequires {
  ngTemplate?: TemplateRef;
}

/**
 * Reemplaza la directiva `ngRef` NATIVA de AngularJS por completo: la nativa tiene `priority: -1` (su `pre`-link
 * corre después de cualquier otra y pisaría el valor), y para `ng-ref-read="ngTemplate"` busca
 * `$element.data('$ngTemplateController')`, que con `transclude: 'element'` no existe y tira. Se reimplementa su
 * comportamiento (asignación al scope + limpieza en `$destroy`) y además se publica como candidato de queries.
 */
export function decorateNgRefDirective(
  $delegate: angular.IDirective[],
  $parse: angular.IParseService,
  $injector: angular.auto.IInjectorService,
): angular.IDirective[] {
  // Lo que `$compileProvider` normalizó al registrar la nativa (`name`, `index`, …) se conserva: un objeto sin
  // `priority` queda afuera cuando se compila con un tope (el clon de un `ng-repeat`, prioridad 1000: `1000 > undefined`
  // es falso), y el `ng-ref` de cada iteración no asignaba nada.
  const [native] = $delegate;
  return [
    {
      ...native,
      priority: 0,
      restrict: "A",
      require: { ngTemplate: "?ngTemplate" },
      link: undefined,
      compile: (_element, attrs) => {
        const getter = $parse(attrs.ngRef);
        const setter = getter.assign;
        if (!setter) throw new Error(`ngRef: la expresión "${attrs.ngRef}" no es asignable`);

        return {
          pre: (scope, linkedElement, linkedAttrs, controllers) => {
            const [linkedNative] = Array.from(linkedElement) as Element[];
            const elementRef = new ElementRefImpl(linkedNative!);
            const templateRef = (controllers as NgRefRequires | undefined)?.ngTemplate;
            const value = NgRefValue.resolve(linkedAttrs.ngRefRead, linkedElement, elementRef, templateRef, $injector);

            const published = CandidatePublisher.publishNamed(scope, linkedAttrs.ngRef, value, linkedNative!);
            scope.$on("$destroy", () => {
              if (getter(scope) === value) setter(scope, null);
              // El elemento sale de la vista (`ng-if`/`ng-repeat`): deja de ser candidato y las queries se re-resuelven.
              for (const registry of published) registry.removeCandidate(value);
            });
            setter(scope, value);
          },
        };
      },
    },
  ];
}
decorateNgRefDirective.$inject = ["$delegate", "$parse", "$injector"];

/**
 * `ng-ref-read` = el `read` de una query unido con el `exportAs` de `#ref="exportAsName"`, en el orden de Angular:
 * 1. sin `read` → el componente del elemento · si es `<ng-template>` el `TemplateRef` · si no el `ElementRef`;
 * 2. `ElementRef`/`TemplateRef`/`ViewContainerRef` por nombre (también en camelCase; `$element`/`ngTemplate` son
 *    alias deprecados);
 * 3. un `exportAs` de una directiva del elemento → su instancia;
 * 4. `$<read>Controller` — una directiva registrada con ese nombre en el elemento.
 */
class NgRefValue {
  private static readonly SYNTHETIC = new Map<string, "ElementRef" | "TemplateRef" | "ViewContainerRef">([
    ["ElementRef", "ElementRef"],
    ["elementRef", "ElementRef"],
    ["TemplateRef", "TemplateRef"],
    ["templateRef", "TemplateRef"],
    ["ViewContainerRef", "ViewContainerRef"],
    ["viewContainerRef", "ViewContainerRef"],
  ]);

  static resolve(
    read: string | undefined,
    element: angular.IAugmentedJQuery,
    elementRef: ElementRefImpl<Element>,
    templateRef: TemplateRef | undefined,
    $injector: angular.auto.IInjectorService,
  ): unknown {
    if (!read) return NgRefValue.componentOn(element) ?? templateRef ?? elementRef;

    // Alias viejos (antes de los nombres de token de Angular): se aceptan, con aviso.
    if (read === "$element" || read === "ngTemplate") {
      NgRefValue.warnLegacy(read);
      return read === "$element" ? elementRef : (templateRef ?? null);
    }

    const synthetic = NgRefValue.SYNTHETIC.get(read);
    if (synthetic === "ElementRef") return elementRef;
    if (synthetic === "TemplateRef") return templateRef ?? null;
    if (synthetic === "ViewContainerRef") return ElementTokens.viewContainerRefOf(element, $injector);

    const byExportAs = NgRefValue.controllersOn(element).find((controller) =>
      CompiledType.def(CompiledType.ofInstance(controller))?.exportAs?.includes(read),
    );
    if (byExportAs) return byExportAs;
    return element.data(`$${read}Controller`) ?? null;
  }

  private static warnedLegacy = false;

  private static warnLegacy(read: string): void {
    if (NgRefValue.warnedLegacy) return;
    NgRefValue.warnedLegacy = true;
    console.warn(`ng-ref-read="${read}" está deprecado; usá "${read === "$element" ? "ElementRef" : "TemplateRef"}".`);
  }

  /** Los controllers que AngularJS guardó en el elemento (`$<nombre>Controller`). */
  private static controllersOn(element: angular.IAugmentedJQuery): object[] {
    const data = (element.data() ?? {}) as Record<string, unknown>;
    return Object.entries(data)
      .filter(([key, value]) => /^\$.+Controller$/.test(key) && value && typeof value === "object")
      .map(([, value]) => value as object);
  }

  private static componentOn(element: angular.IAugmentedJQuery): unknown {
    return NgRefValue.controllersOn(element).find((controller) =>
      CompiledType.isComponent(CompiledType.ofInstance(controller)),
    );
  }
}
