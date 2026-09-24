import type angular from "angular";
import { ChangeDetectorRef, ChangeDetectorRefImpl } from "@/core/change-detection/change-detector-ref.ts";
import { injectionTokenName } from "@/core/di/injector.ts";
import { CompiledType } from "@/core/metadata/compiled-type.ts";
import { DestroyRef, DestroyRefImpl } from "@/core/refs/destroy-ref.ts";
import { ElementRef, ElementRefImpl } from "@/core/refs/element-ref.ts";
import { TemplateRef } from "@/core/refs/template-ref.ts";
import { ViewContainerRef, ViewContainerRefImpl } from "@/core/refs/view-container-ref.ts";
import { decorateControllerWith } from "@/native/bridges/shared.ts";
import { AsyncPipe, AsyncPipeImpl } from "@/pipes/async-pipe.ts";

/** Clave de `$element.data()` del `ViewContainerRef` de un elemento — la lee `ng-ref-read="viewContainerRef"`. */
export const VIEW_CONTAINER_REF_DATA_KEY = "$viewContainerRefController";

type Locals = Record<string, unknown>;

interface ElementContext {
  $element: angular.IAugmentedJQuery;
  $scope: angular.IScope;
  $injector: angular.auto.IInjectorService;
}

type TokenFactory = (context: ElementContext) => unknown;

/**
 * Tokens que no son servicios de la app sino de CADA elemento (`ElementRef`, `ChangeDetectorRef`, `DestroyRef`,
 * `ViewContainerRef`, `TemplateRef`, `AsyncPipe`): no hay un `.factory()` global que los dé, dependen de qué
 * `$element`/`$scope` construye cada controller. Se agregan a los `locals` de `$controller` bajo su nombre de DI
 * compilado (`ɵprov.token`) — el mismo que pide el `ɵfac` — y solo los que la clase pide.
 *
 * `inject()` de runtime durante la construcción (una función de librería como `takeUntilDestroyed()`) los resuelve
 * con `resolve()`: mismo valor que los `locals` de esa construcción.
 */
export class ElementTokens {
  private static byName?: Map<string, TokenFactory>;
  /** Valores ya creados por construcción (clave: los `locals`), así `locals` e `inject()` ven la misma instancia. */
  private static readonly created = new WeakMap<object, Map<string, unknown>>();

  private static factories(): Map<string, TokenFactory> {
    ElementTokens.byName ??= new Map<string, TokenFactory>([
      [injectionTokenName(ElementRef), ({ $element }) => new ElementRefImpl($element[0] as Element)],
      [injectionTokenName(ChangeDetectorRef), ({ $scope }) => new ChangeDetectorRefImpl($scope)],
      [injectionTokenName(DestroyRef), ({ $scope }) => new DestroyRefImpl($scope)],
      [injectionTokenName(AsyncPipe), ({ $scope }) => new AsyncPipeImpl($scope)],
      [injectionTokenName(ViewContainerRef), ({ $element, $injector }) => ElementTokens.viewContainerRefOf($element, $injector)],
      // El `<ng-template>` donde está (o del que sale) este elemento: el controller de la directiva `ngTemplate`.
      [injectionTokenName(TemplateRef), ({ $element }) => $element.controller("ngTemplate") ?? null],
    ]);
    return ElementTokens.byName;
  }

  /** Un `ViewContainerRef` por elemento (se crea la primera vez), descubrible por `$element.data()`. */
  static viewContainerRefOf($element: angular.IAugmentedJQuery, $injector: angular.auto.IInjectorService): unknown {
    const existing = $element.data(VIEW_CONTAINER_REF_DATA_KEY);
    if (existing) return existing;
    const viewContainerRef = new ViewContainerRefImpl(new ElementRefImpl($element[0] as HTMLElement), $injector);
    $element.data(VIEW_CONTAINER_REF_DATA_KEY, viewContainerRef);
    return viewContainerRef;
  }

  static has(name: string): boolean {
    return ElementTokens.factories().has(name);
  }

  /** El valor de `name` para la construcción con estos `locals` (`undefined` si no es un token de elemento). */
  static resolve(name: string, locals: Locals | undefined, $injector: angular.auto.IInjectorService): unknown {
    const factory = ElementTokens.factories().get(name);
    const $element = locals?.$element as angular.IAugmentedJQuery | undefined;
    const $scope = locals?.$scope as angular.IScope | undefined;
    if (!factory || !locals || !$element?.[0] || !$scope) return undefined;

    let values = ElementTokens.created.get(locals);
    if (!values) {
      values = new Map();
      ElementTokens.created.set(locals, values);
    }
    if (!values.has(name)) values.set(name, factory({ $element, $scope, $injector }));
    return values.get(name);
  }

  /** `locals` con los tokens de elemento que pide `expression` (los que ya estén no se pisan). */
  static augment(
    locals: Locals | undefined,
    expression: unknown,
    $injector: angular.auto.IInjectorService,
  ): Locals | undefined {
    let augmented: Locals | undefined;
    for (const name of CompiledType.depNames(expression)) {
      if (!ElementTokens.has(name) || (locals && Object.hasOwn(locals, name))) continue;
      augmented ??= { ...locals };
      augmented[name] = ElementTokens.resolve(name, locals, $injector);
    }
    return augmented ?? locals;
  }
}

export function decorateControllerElementTokens(
  $delegate: angular.IControllerService,
  $injector: angular.auto.IInjectorService,
): angular.IControllerService {
  return decorateControllerWith($delegate, {
    augmentLocals: (locals, expression) => ElementTokens.augment(locals, expression, $injector),
  });
}
decorateControllerElementTokens.$inject = ["$delegate", "$injector"];
