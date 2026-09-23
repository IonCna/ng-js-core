import { Directive } from "@/core/metadata/directive.ts";

/** Contenedor estructural; su expansión runtime queda a cargo del bridge. */
@Directive({ selector: "ng-container" })
export class NgContainer {}
