import type {IDirective, IDirectiveCompileFn, IParseService} from "angular";

class TemplateNgRef implements IDirective{
    private static TEMPLATE_REF_NODE_NAME = "ng-template"

   static $compileFn($parse: IParseService): IDirectiveCompileFn {
     return (el, attrs) => {
       const [native] = Array.from(el)
       const nodeName = native.nodeName.toLowerCase();

       if(nodeName != TemplateNgRef.TEMPLATE_REF_NODE_NAME) return;

       const getter = $parse(attrs.ngRef);
       const setter = getter.assign

       if(!setter) return;

       el.removeAttr("ng-ref")
       el.removeAttr("ng-ref-read")

       return {
           pre: (scope, _anchor, _attrs, templateRef) => {
               setter(scope, templateRef);

               scope.$on("$destroy", () => {
                   const isCtrl = getter(scope) == templateRef;
                   if(!isCtrl) return;

                   setter(scope, null);
               });
           }
       }
     }
   }

    static $factory(extraProps: IDirective, $parse: IParseService): IDirective {
        return {
            ...extraProps,
            restrict: "A",
            bindToController: true,
            require: "?ngTemplate",
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
