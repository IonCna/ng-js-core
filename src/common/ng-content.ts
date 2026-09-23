import { Directive } from "@/core/metadata/directive.ts";

/** Punto de proyección; el bridge resolverá el contenido transcluido. */
@Directive({ selector: "ng-content" })
export class NgContent {}
