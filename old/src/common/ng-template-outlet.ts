import { Directive } from "@/core/metadata/directive.ts";

/**
 * `*ngTemplateOutlet` — clase `@Directive` que **solo estampa** metadata. El CLI
 * la vuelve `.directive("ngTemplateOutlet", …)`. La implementación (destruir/crear
 * la vista embebida en cada `$onChanges`) vive pelada en
 * `ngjs-core/runtime/common/ng-template-outlet.ts`.
 */
@Directive({
  selector: "[ng-template-outlet]",
  restrict: "A",
  scope: true,
  bindToController: {
    ngTemplateOutlet: "<",
    ngTemplateOutletContext: "<?",
  },
})
export class NgTemplateOutlet {}
