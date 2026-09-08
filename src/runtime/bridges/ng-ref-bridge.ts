import type angular from "angular";
import { ContentChildQuery, createDecoratedContentChildQueries } from "@/core/queries/content-child.ts";
import { ContentChildrenQuery, createDecoratedContentChildrenQueries } from "@/core/queries/content-children.ts";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import { getDirectiveDef } from "@/core/metadata/directive.ts";
import { getControllerTokens } from "@/core/queries/controller-tokens.ts";
import {
  getAncestorQueryRegistries,
  getContentQueryOwners,
  getScopeViewQueryRegistries,
  registerScopeQueryRegistry,
} from "@/core/queries/query-context.ts";
import { createDecoratedViewChildQueries, ViewChildQuery } from "@/core/queries/view-child.ts";
import { createDecoratedViewChildrenQueries, ViewChildrenQuery } from "@/core/queries/view-children.ts";
import { ViewQueryRegistry } from "@/core/queries/view-query-registry.ts";
import { ElementRefImpl } from "@/core/refs/element-ref.ts";
import type { TemplateRef } from "@/core/refs/template-ref.ts";
import { decorateControllerWith, prependInstanceMethod } from "@/runtime/bridges/shared.ts";

const controllerNodes = new WeakMap<object, Node>();

/**
 * Por cada controller instanciado: arma su propio `ViewQueryRegistry`,
 * "instala" sus queries (`viewChild()`/`@ViewChild`/`contentChild()`/
 * `@ContentChild` y sus plurales, reemplaza el campo por un getter que lee
 * `.value`), se publica como candidato — de vista en el registry del padre
 * más cercano (por su cadena de clases, automático vía `$scope.$parent`), y
 * de contenido en los "dueños" que haya bindeado `<ng-content>` (vacío hasta
 * que esa pieza exista, ver `query-context.ts`) — y engancha `resolve()` a
 * `$postLink`, cuando ya está garantizado que todos los hijos se publicaron.
 */
export function decorateControllerViewChildQueries($delegate: angular.IControllerService): angular.IControllerService {
  return decorateControllerWith($delegate, {
    onInstance: (instance, locals) => {
      if (!instance || typeof instance !== "object") return;

      const $scope = locals?.$scope as angular.IScope | undefined;
      const $element = locals?.$element as angular.IAugmentedJQuery | undefined;
      const node = $element?.[0] as Node | undefined;
      const registry = new ViewQueryRegistry();
      if (node) {
        controllerNodes.set(instance, node);
        // Una `@Directive` SIN template (no `@Component`) proyecta light DOM:
        // sus `@ContentChild`/`@ContentChildren` matchean descendientes del host
        // sin `<ng-content>` de por medio. Un `@Component` NO — su contenido va
        // por `<ng-content>` (que llama `bindContentQueryOwners`).
        const Clase = (instance as { constructor: Function }).constructor;
        if (!getComponentDef(Clase) && getDirectiveDef(Clase)) registry.hostNode = node;
      }

      installOwnQueries(instance, registry);

      if ($scope) {
        registerScopeQueryRegistry($scope, registry);
        // Re-resolver (vía `$evalAsync`, coalescido dentro del digest) cuando el
        // contenido proyectado cambia después del primer `resolve()` — así el
        // `QueryList` de `@ContentChildren` emite en `.changes`.
        let pending = false;
        registry.onDynamicChange = () => {
          if (pending) return;
          pending = true;
          $scope.$evalAsync(() => {
            pending = false;
            registry.resolve();
          });
        };
        publishToOwners(instance, $scope, registry);
        $scope.$on("$destroy", () => registry.destroy());
      }

      // Antes del `$postLink` del autor: las queries leídas ahí (incluidas las
      // `{ static: true }`) tienen que estar resueltas, como en Angular.
      prependInstanceMethod(instance, "$postLink", () => registry.resolve());
    },
  });
}
decorateControllerViewChildQueries.$inject = ["$delegate"];

function installOwnQueries(instance: object, registry: ViewQueryRegistry): void {
  for (const key of Reflect.ownKeys(instance)) {
    const descriptor = Object.getOwnPropertyDescriptor(instance, key);
    if (!descriptor) continue;

    if (descriptor.value instanceof ViewChildQuery) {
      install(
        instance,
        key,
        descriptor.enumerable ?? true,
        () => descriptor.value.value,
        () => registry.registerQuery(descriptor.value),
      );
    } else if (descriptor.value instanceof ViewChildrenQuery) {
      install(
        instance,
        key,
        descriptor.enumerable ?? true,
        () => descriptor.value.value,
        () => registry.registerChildrenQuery(descriptor.value),
      );
    } else if (descriptor.value instanceof ContentChildQuery) {
      install(
        instance,
        key,
        descriptor.enumerable ?? true,
        () => descriptor.value.value,
        () => registry.registerContentQuery(descriptor.value),
      );
    } else if (descriptor.value instanceof ContentChildrenQuery) {
      install(
        instance,
        key,
        descriptor.enumerable ?? true,
        () => descriptor.value.value,
        () => registry.registerContentChildrenQuery(descriptor.value),
      );
    }
  }

  for (const { propertyKey, query } of createDecoratedViewChildQueries(instance)) {
    install(
      instance,
      propertyKey,
      true,
      () => query.value,
      () => registry.registerQuery(query),
    );
  }
  for (const { propertyKey, query } of createDecoratedViewChildrenQueries(instance)) {
    install(
      instance,
      propertyKey,
      true,
      () => query.value,
      () => registry.registerChildrenQuery(query),
    );
  }
  for (const { propertyKey, query } of createDecoratedContentChildQueries(instance)) {
    install(
      instance,
      propertyKey,
      true,
      () => query.value,
      () => registry.registerContentQuery(query),
    );
  }
  for (const { propertyKey, query } of createDecoratedContentChildrenQueries(instance)) {
    install(
      instance,
      propertyKey,
      true,
      () => query.value,
      () => registry.registerContentChildrenQuery(query),
    );
  }
}

function install(
  instance: object,
  key: PropertyKey,
  enumerable: boolean,
  getValue: () => unknown,
  register: () => void,
): void {
  register();
  Object.defineProperty(instance, key, {
    configurable: true,
    enumerable,
    get: getValue,
  });
}

function publishToOwners(instance: object, $scope: angular.IScope, ownRegistry?: ViewQueryRegistry): void {
  const tokens = getControllerTokens(instance);
  if (tokens.length === 0) return;
  const node = controllerNodes.get(instance);

  const published: ViewQueryRegistry[] = [];
  for (const registry of getAncestorQueryRegistries($scope)) {
    registry.registerCandidate(tokens, instance, node);
    published.push(registry);
  }
  for (const owner of getContentQueryOwners($scope)) {
    owner.registerContentCandidate(tokens, instance, node);
    published.push(owner);
  }

  // Light DOM: `@ContentChild`/`@ContentChildren` sobre una `@Directive` sin
  // template comparte `$scope` con este controller, así que no aparece en
  // `getAncestorQueryRegistries` ni en `getContentQueryOwners`. Se publica como
  // candidato de contenido a las registries del MISMO scope marcadas como
  // light-DOM (host sin template) cuyo host contenga este nodo.
  for (const registry of getScopeViewQueryRegistries($scope)) {
    if (registry === ownRegistry || !registry.hostNode || !registry.hasContentQueries) continue;
    if (registry.containsLightDomNode(node)) {
      registry.registerContentCandidate(tokens, instance, node);
      published.push(registry);
    }
  }

  // Cuando este controller proyectado se destruye (`ng-if`/`ng-repeat` lo saca),
  // hay que quitar su candidato de los registries donde lo publicó y re-resolver.
  if (published.length > 0) {
    $scope.$on("$destroy", () => {
      for (const registry of published) registry.removeCandidate(instance);
    });
  }
}

interface NgRefRequires {
  ngTemplate?: TemplateRef;
}

/**
 * Reemplaza la directiva `ngRef` NATIVA de AngularJS por completo — no
 * alcanza con agregar la nuestra al lado (`$delegate.unshift(...)`, como
 * hace `reference/`): la nativa tiene `priority: -1` (la más baja posible,
 * a propósito, ver su código fuente), así que su `pre`-link SIEMPRE corre
 * DESPUÉS de cualquier directiva agregada con prioridad más alta — pisaría
 * el valor que resolvimos acá. Peor: para `ng-ref-read="ngTemplate"` la
 * nativa intenta su propio `$element.data('$ngTemplateController')`, que
 * confirmamos (`template-ref.test.ts`) que NO funciona para
 * `transclude:'element'` — y ahí directamente tira un error. Reimplementamos
 * su comportamiento entero (asignación al scope + limpieza en `$destroy`)
 * para no dejarla correr en absoluto.
 */
export function decorateNgRefDirective(
  _$delegate: angular.IDirective[],
  $parse: angular.IParseService,
): angular.IDirective[] {
  return [
    {
      restrict: "A",
      require: { ngTemplate: "?ngTemplate" },
      compile: compileNgRef($parse),
    },
  ];
}
decorateNgRefDirective.$inject = ["$delegate", "$parse"];

function compileNgRef($parse: angular.IParseService): angular.IDirectiveCompileFn {
  return (_element, attrs) => {
    const getter = $parse(attrs.ngRef);
    const setter = getter.assign;
    if (!setter) {
      throw new Error(`ngRef: la expresión "${attrs.ngRef}" no es asignable`);
    }

    return {
      pre: (scope, linkedElement, linkedAttrs, controllers) => {
        const [linkedNative] = Array.from(linkedElement) as Element[];
        const elementRef = new ElementRefImpl(linkedNative);
        const templateRef = (controllers as NgRefRequires | undefined)?.ngTemplate;
        const value = resolveNgRefValue(linkedAttrs.ngRefRead, linkedElement, elementRef, templateRef);

        publishNgRefCandidate(scope, linkedAttrs.ngRef, value);

        scope.$on("$destroy", () => {
          if (getter(scope) !== value) return;
          setter(scope, null);
        });

        setter(scope, value);
      },
    };
  };
}

/**
 * Sin `ng-ref-read`: el default es `TemplateRef` si el elemento es
 * `<ng-template>` (vía `require`), si no `ElementRef`. Con `read`:
 * `"$element"`/`"ngTemplate"` son casos fijos; cualquier otro string es "el
 * controller de otra directiva con ese nombre en el mismo elemento" —
 * incluye `"viewContainerRef"`, que ya es descubrible así gracias a
 * `view-container-ref-bridge.ts` (sin necesitar un directive `<ng-container>`
 * aparte, a diferencia de `reference/`).
 */
function resolveNgRefValue(
  read: string | undefined,
  linkedElement: angular.IAugmentedJQuery,
  elementRef: ElementRefImpl,
  templateRef: TemplateRef | undefined,
): unknown {
  if (!read) return templateRef ?? elementRef;
  if (read === "$element") return elementRef;
  if (read === "ngTemplate") return templateRef;
  return linkedElement.data(`$${read}Controller`);
}

function publishNgRefCandidate(scope: angular.IScope, locator: string, value: unknown): void {
  const node = getValueNode(value);

  for (const registry of [...getScopeViewQueryRegistries(scope), ...getAncestorQueryRegistries(scope)]) {
    registry.registerNamedCandidate(locator, value, node);
  }

  for (const owner of getContentQueryOwners(scope)) {
    owner.registerNamedContentCandidate(locator, value, node);
  }
}

function getValueNode(value: unknown): Node | undefined {
  if (!value || typeof value !== "object") return undefined;
  const nativeElement = (value as { nativeElement?: unknown }).nativeElement;
  return nativeElement instanceof Node ? nativeElement : undefined;
}
