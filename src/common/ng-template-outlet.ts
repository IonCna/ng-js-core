import { Directive } from "@/core/metadata/directive.ts";
import { Input } from "@/core/metadata/input.ts";

/** Directiva declarativa; la creación de la vista embebida queda para el bridge. */
@Directive({ selector: "[ngTemplateOutlet]" })
export class NgTemplateOutlet {
  @Input() ngTemplateOutlet?: unknown;
  @Input() ngTemplateOutletContext?: unknown;
}
