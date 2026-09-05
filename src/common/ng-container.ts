import { Directive } from "@/core/metadata/directive.ts";

/**
 * `<ng-container>` — clase `@Directive` que **solo estampa** metadata. El CLI la
 * vuelve `.directive("ngContainer", …)`. La implementación (transclude 'element',
 * exponer el `ViewContainerRef`) vive pelada en
 * `ngjs-core/runtime/common/ng-container.ts`.
 */
@Directive({ selector: "ng-container", restrict: "E", transclude: "element", bindToController: true })
export class NgContainer {}
