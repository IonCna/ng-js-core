import { Directive } from "@/core/metadata/directive.ts";

/**
 * `<ng-content>` — clase `@Directive` que **solo estampa** metadata. El CLI la
 * vuelve `.directive("ngContent", …)`. La implementación (llamar `$transclude` a
 * mano, bindear los content-query owners) vive pelada en
 * `ngjs-core/runtime/common/ng-content.ts`.
 */
@Directive({ selector: "ng-content", restrict: "E" })
export class NgContent {}
