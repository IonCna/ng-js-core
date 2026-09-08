import { selectorToRegistrationName } from "@/core/metadata/selector-name.ts";

/**
 * `exportAs` → nombre de registro AngularJS de la directiva/componente.
 *
 * Angular deja hacer `#ref="fooDir"` (acá: `ng-ref="ref" ng-ref-read="fooDir"`)
 * para agarrar la **instancia** de la directiva cuyo `exportAs` es `"fooDir"`,
 * aunque su selector sea otro. Una directiva puede exportar varios nombres
 * (`exportAs: "foo, bar"`).
 *
 * Clase (no un `Map` suelto) para poder resetear en tests, mismo criterio que
 * `InjectableNameRegistry` / `SelectorRegistry`.
 */
class ExportAsRegistry {
  private readonly byName = new Map<string, string>();

  register(exportAs: string | undefined, selector: string): void {
    if (!exportAs) return;
    const registrationName = selectorToRegistrationName(selector);
    for (const raw of exportAs.split(",")) {
      const name = raw.trim();
      if (name) this.byName.set(name, registrationName);
    }
  }

  /** Nombre de registro de la directiva cuyo `exportAs` es `name`, o `undefined`. */
  registrationNameFor(name: string): string | undefined {
    return this.byName.get(name);
  }

  clear(): void {
    this.byName.clear();
  }
}

export const exportAsRegistry = new ExportAsRegistry();
