/**
 * Lo que `ng-js-compiler` estampa en cada clase y que el runtime de `ngjs-core` lee — la misma forma que el
 * contrato del compilador (`ng-js-compiler/contract`), acá solo lo que se usa. Los decoradores de `ngjs-core` no
 * guardan nada: TODA la metadata que el runtime necesita sale de estos campos.
 */

/** Una query (`@ViewChild`/`@ContentChildren`/…) — `predicate`/`read` son getters (se resuelven al leerse). */
export interface CompiledQueryDef {
  propertyName: string;
  first: boolean;
  descendants: boolean;
  static: boolean;
  readonly predicate: Function | string[];
  readonly read?: unknown;
}

export interface CompiledHostDirectiveDef {
  readonly directive: Function;
  inputs?: string[];
  outputs?: string[];
}

/** `ɵcmp`/`ɵdir`: `inputs`/`outputs` como mapa nombre público → propiedad (forma de Ivy). */
export interface CompiledDirectiveDef {
  /** Como Ivy: `[tag, attr, valor, ..., flag, ...]` por alternativa (`SelectorFlags`: `NOT` 1, `CLASS` 8, …). */
  selectors: (string | number)[][];
  inputs: Record<string, string>;
  outputs: Record<string, string>;
  exportAs?: string[];
  queries?: CompiledQueryDef[];
  viewQueries?: CompiledQueryDef[];
  hostDirectives?: CompiledHostDirectiveDef[];
  /** Solo `ɵcmp`: el objeto de `.component()` sin `controller` — para registrarlo al vuelo (`loadComponent`). */
  definition?: Record<string, unknown>;
}

/** Una receta de `ɵfac.ɵproviders` (providers de `@Component`/`@Directive`). */
export interface CompiledProviderDescriptor {
  token: string;
  kind: string;
  multi?: true;
}

/** `ɵfac`: la anotación de AngularJS con la que `$controller`/`$injector` construye la clase. */
export type CompiledFactory = unknown[] & {
  ɵproviders?: CompiledProviderDescriptor[];
  ɵcomponent?: true;
  ɵtype?: Function;
};

interface CompiledFields {
  ɵfac?: CompiledFactory;
  ɵcmp?: CompiledDirectiveDef;
  ɵdir?: CompiledDirectiveDef;
  ɵprov?: { token: string };
}

/** Lectura de lo que el compilador dejó en una clase o en el `expression` que recibe `$controller`. */
export class CompiledType {
  /** La clase que va a construir `$controller` (`ɵfac.ɵtype`), si `expression` es el `ɵfac` de una. */
  static ofExpression(expression: unknown): Function | undefined {
    return Array.isArray(expression) ? (expression as CompiledFactory).ɵtype : undefined;
  }

  /** Nombres de DI que pide `expression` (anotación en array, o `$inject` de una función). */
  static depNames(expression: unknown): string[] {
    if (Array.isArray(expression)) return expression.slice(0, -1) as string[];
    return ((expression as { $inject?: string[] } | undefined)?.$inject ?? []).slice();
  }

  /** `ɵcmp` o `ɵdir` PROPIO de la clase (el de una base no cuenta: un estático de JS se hereda). */
  static def(type: Function | undefined): CompiledDirectiveDef | undefined {
    if (!type) return undefined;
    const fields = type as unknown as CompiledFields;
    if (Object.hasOwn(type, "ɵcmp")) return fields.ɵcmp;
    if (Object.hasOwn(type, "ɵdir")) return fields.ɵdir;
    return undefined;
  }

  static isComponent(type: Function | undefined): boolean {
    return !!type && Object.hasOwn(type, "ɵcmp");
  }

  /** Clase de una instancia construida por `$controller` (su `constructor`). */
  static ofInstance(instance: unknown): Function | undefined {
    return instance && typeof instance === "object" ? (instance as { constructor: Function }).constructor : undefined;
  }

  /** Nombres de DI de los `providers` propios de un `@Component`/`@Directive`. */
  static providerTokens(type: Function | undefined): string[] {
    const factory = type && Object.hasOwn(type, "ɵfac") ? (type as unknown as CompiledFields).ɵfac : undefined;
    return (factory?.ɵproviders ?? []).map((provider) => provider.token);
  }

  /**
   * Nombres con que AngularJS registró la directiva/componente (camelCase del atributo, si no de la clase, si no del
   * tag) — la clave `$<nombre>Controller` de `$element.data()` donde queda su instancia.
   */
  static registrationNames(type: Function | undefined): string[] {
    return [...new Set(CompiledType.registrations(type).map(({ name }) => name))];
  }

  /** Cómo registra AngularJS cada alternativa del selector (lo mismo que decide el compilador). */
  static registrations(type: Function | undefined): { name: string; restrict: "A" | "C" | "E"; tag?: string }[] {
    const def = CompiledType.def(type);
    if (!def) return [];
    return def.selectors.flatMap((selector): { name: string; restrict: "A" | "C" | "E"; tag?: string }[] => {
      const parsed = CompiledType.parseSelector(selector);
      const tag = parsed.tag || undefined;
      if (parsed.attributes[0])
        return [{ name: CompiledType.camelCase(parsed.attributes[0]), restrict: "A" as const, tag }];
      if (parsed.classes[0]) return [{ name: CompiledType.camelCase(parsed.classes[0]), restrict: "C" as const, tag }];
      return tag ? [{ name: CompiledType.camelCase(tag), restrict: "E" as const }] : [];
    });
  }

  /** `[tag, attr, valor, ..., CLASS, clase, ..., NOT | X, ...]` → lo positivo (lo negado no registra nada). */
  private static parseSelector(selector: (string | number)[]): {
    tag: string;
    attributes: string[];
    classes: string[];
  } {
    const CLASS = 8;
    const NOT = 1;
    const result = { tag: String(selector[0] ?? ""), attributes: [] as string[], classes: [] as string[] };
    let mode: "attribute" | "class" | "not" = "attribute";
    for (let i = 1; i < selector.length; i++) {
      const item = selector[i];
      if (typeof item === "number") {
        mode = item & NOT ? "not" : item & CLASS ? "class" : "attribute";
        continue;
      }
      if (mode === "class") result.classes.push(item as string);
      else if (mode === "attribute") {
        result.attributes.push(item as string);
        i++; // su valor
      }
    }
    return result;
  }

  /** La instancia de `type` (o de una subclase registrada con su nombre) en `$element` o sus ancestros. */
  static instanceOn(element: { controller?(name: string): unknown } | undefined, type: Function): unknown {
    if (!element?.controller) return undefined;
    for (const name of CompiledType.registrationNames(type)) {
      const found = element.controller(name);
      if (found instanceof type) return found;
    }
    return undefined;
  }

  /** Tag del selector de elemento de un `@Component` (`undefined` si no es uno, o su selector es de atributo). */
  static componentTag(type: Function | undefined): string | undefined {
    if (!CompiledType.isComponent(type)) return undefined;
    return CompiledType.registrations(type)
      .find(({ restrict }) => restrict === "E")
      ?.name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
  }

  /** `app-card` → `appCard` (nombre de registro de AngularJS). */
  static camelCase(value: string): string {
    return value.replace(/-([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
  }
}
