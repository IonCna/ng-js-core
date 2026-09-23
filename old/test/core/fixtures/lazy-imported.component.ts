import { component } from "@/core/metadata/component.ts";
import { Input } from "@/core/metadata/input.ts";

/** Fixture separado a propósito: simula un chunk cargado con `import()` real, no ya presente en el módulo del test. */
export class LazyImportedComponent {
  @Input() greeting = "";
}
component(LazyImportedComponent).define({ selector: "lazy-imported" });
