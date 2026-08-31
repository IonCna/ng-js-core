import type { IDirective, IDirectiveCompileFn, IParseService, IScope } from "angular";
import { TemplateRef } from "@/common/ng-template";
import { ElementRef, ElementRefImpl } from "@/core/abstractions/element-ref";
import { ViewContainerRef } from "@/core/abstractions/view-container-ref";
import {
  getContentQueryOwners,
  getScopeViewQueryRegistries,
  type ViewQueryRegistry,
} from "@/core/decorators/ng-controller";
import type { ProviderToken } from "@/core/viewChild";

function findViewQueryRegistry(
  scope: IScope,
  locator: string,
  candidates: ReadonlyMap<ProviderToken<unknown>, unknown>,
): ViewQueryRegistry | undefined {
  let current: IScope | null = scope;

  while (current) {
    const registry = getScopeViewQueryRegistries(current).find((candidate) =>
      candidate.acceptsReference(locator, candidates),
    );
    if (registry) return registry;

    current = current.$parent;
  }

  return undefined;
}

// biome-ignore lint/complexity/noStaticOnlyClass: Keeps the AngularJS directive compile/factory behavior grouped.
class TemplateNgRef implements IDirective {
  static $compileFn($parse: IParseService): IDirectiveCompileFn {
    return (el, attrs) => {
      const [native] = Array.from(el);

      const read = attrs.ngRefRead;
      const getter = $parse(attrs.ngRef);
      const setter = getter.assign;

      if (!setter) return;

      el.removeAttr("ng-ref");
      el.removeAttr("ng-ref-read");

      return {
        pre: (scope, linkedElement, _attrs, controllers) => {
          const [linkedNative = native] = Array.from(linkedElement);
          const nativeEl = new ElementRefImpl(linkedNative);
          const templateRef = controllers?.ngTemplate as TemplateRef | undefined;
          const viewContainerRef = controllers?.ngContainer?.viewContainerRef as ViewContainerRef | undefined;
          const cases: Record<string, TemplateRef | ViewContainerRef | ElementRef | undefined> = {
            ngTemplate: templateRef,
            viewContainerRef,
            $element: nativeEl,
          };

          const directiveController = read ? linkedElement.data(`$${read}Controller`) : undefined;
          const defaultValue = templateRef ?? nativeEl;
          const value = read ? (cases[read] ?? directiveController) : defaultValue;
          const candidates = new Map<ProviderToken<unknown>, unknown>([
            [ElementRef, nativeEl],
            [ElementRefImpl, nativeEl],
            ["$element", nativeEl],
          ]);

          if (directiveController !== undefined) {
            candidates.set(read, directiveController);
          }

          if (templateRef) {
            candidates.set(TemplateRef, templateRef);
            candidates.set("ngTemplate", templateRef);
          }

          if (viewContainerRef) {
            candidates.set(ViewContainerRef, viewContainerRef);
            candidates.set("viewContainerRef", viewContainerRef);
          }

          const disconnect = findViewQueryRegistry(scope, attrs.ngRef, candidates)?.connectReference(
            attrs.ngRef,
            value,
            candidates,
            linkedNative,
          );
          const contentDisconnects = getContentQueryOwners(scope)
            .filter((owner) => owner.acceptsContentReference(attrs.ngRef, candidates))
            .map((owner) => owner.connectContentReference(attrs.ngRef, value, candidates, linkedNative));

          scope.$on("$destroy", () => {
            disconnect?.();
            for (const disconnectContent of contentDisconnects) {
              disconnectContent();
            }
            if (getter(scope) !== value) return;

            setter(scope, null);
          });

          setter(scope, value);
        },
      };
    };
  }

  static $factory(extraProps: IDirective, $parse: IParseService): IDirective {
    return {
      ...extraProps,
      restrict: "A",
      bindToController: true,
      require: {
        ngTemplate: "?ngTemplate",
        ngContainer: "?ngContainer",
      },
      compile: TemplateNgRef.$compileFn($parse),
      priority: 1,
    };
  }
}

export const decorNgRef = ($delegate: IDirective[], $parse: IParseService): IDirective[] => {
  const [nativeNgRef] = $delegate;
  const templateNgRef = TemplateNgRef.$factory(nativeNgRef, $parse);

  $delegate.unshift(templateNgRef);
  return $delegate;
};

decorNgRef.$inject = ["$delegate", "$parse"];
