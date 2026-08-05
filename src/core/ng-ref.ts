import type {IDirective, IDirectiveCompileFn, IParseService} from "angular";
import type {TemplateRef} from "@/common";
import type {ViewContainerRef} from "@/core/refs";
import {ElementRef} from "@/core";

class TemplateNgRef implements IDirective {
    private static TEMPLATE_REF_NODE_NAME = "ng-template"
    private static CONTAINER_REF_NODE_NAME = "ng-container";

    static $compileFn($parse: IParseService): IDirectiveCompileFn {
        return (el, attrs) => {
            const [native] = Array.from(el)
            const nodeName = native.nodeName.toLowerCase();

            const isTemplate = nodeName == TemplateNgRef.TEMPLATE_REF_NODE_NAME;
            const isContainer = nodeName == TemplateNgRef.CONTAINER_REF_NODE_NAME;

            if (!isTemplate && !isContainer) return;

            const read = attrs.ngRefRead;
            const getter = $parse(attrs.ngRef);
            const setter = getter.assign

            if (!setter) return;

            el.removeAttr("ng-ref")
            el.removeAttr("ng-ref-read")

            return {
                pre: (scope, _el, _attrs, controllers) => {
                    const nativeEl = new ElementRef(native);
                    const cases: Record<string, TemplateRef | ViewContainerRef | ElementRef | undefined> = {
                        "ngTemplate": controllers?.ngTemplate as TemplateRef,
                        "viewContainerRef": controllers?.ngContainer?.viewContainerRef as ViewContainerRef,
                        "$element": nativeEl
                    }

                    const value = cases[read];

                    scope.$on("$destroy", () => {
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
