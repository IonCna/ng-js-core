import type {IDirective, IDirectiveCompileFn, IParseService, IScope} from "angular";
import {TemplateRef} from "@/common/ng-template";
import {getScopeViewQueryRegistries, type ViewQueryRegistry} from "@/core/ng-controller";
import {ViewContainerRef} from "@/core/refs";
import type {ProviderToken} from "@/core/viewChild";
import {ElementRef} from "@/core";

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

class TemplateNgRef implements IDirective {
    static $compileFn($parse: IParseService): IDirectiveCompileFn {
        return (el, attrs) => {
            const [native] = Array.from(el)

            const read = attrs.ngRefRead;
            const getter = $parse(attrs.ngRef);
            const setter = getter.assign

            if (!setter) return;

            el.removeAttr("ng-ref")
            el.removeAttr("ng-ref-read")

            return {
                pre: (scope, linkedElement, _attrs, controllers) => {
                    const [linkedNative = native] = Array.from(linkedElement);
                    const nativeEl = new ElementRef(linkedNative);
                    const templateRef = controllers?.ngTemplate as TemplateRef | undefined;
                    const viewContainerRef = controllers?.ngContainer?.viewContainerRef as ViewContainerRef | undefined;
                    const cases: Record<string, TemplateRef | ViewContainerRef | ElementRef | undefined> = {
                        "ngTemplate": templateRef,
                        "viewContainerRef": viewContainerRef,
                        "$element": nativeEl
                    }

                    const value = cases[read];
                    const candidates = new Map<ProviderToken<unknown>, unknown>([
                        [ElementRef, nativeEl],
                        ["$element", nativeEl],
                    ]);

                    if (templateRef) {
                        candidates.set(TemplateRef, templateRef);
                        candidates.set("ngTemplate", templateRef);
                    }

                    if (viewContainerRef) {
                        candidates.set(ViewContainerRef, viewContainerRef);
                        candidates.set("viewContainerRef", viewContainerRef);
                    }

                    const defaultValue = templateRef ?? nativeEl;
                    const disconnect = findViewQueryRegistry(
                        scope,
                        attrs.ngRef,
                        candidates,
                    )?.connectReference(
                        attrs.ngRef,
                        defaultValue,
                        candidates,
                    );

                    scope.$on("$destroy", () => {
                        disconnect?.();
                        const isCtrl = getter(scope) == value;
                        if (!isCtrl) return;

                        setter(scope, null);
                    });

                    if(!value) {
                        setter(scope, nativeEl);
                        return
                    }

                    setter(scope, value);
                }
            }
        }
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
            priority: 1
        }
    }
}

export const decorNgRef = ($delegate: IDirective[], $parse: IParseService) => {
    const [nativeNgRef] = $delegate
    const templateNgRef = TemplateNgRef.$factory(nativeNgRef, $parse);

    $delegate.unshift(templateNgRef)
    return $delegate
}

decorNgRef.$inject = ["$delegate", "$parse"]
