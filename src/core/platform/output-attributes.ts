import type angular from "angular";

/**
 * Lo mismo que `ng-js-compiler` emite junto al registro de un `@Component`/`@Directive` con outputs, para lo que core
 * registra al vuelo: en Angular un output (`(hidden)="…"`) nunca llega al DOM; en AngularJS el binding `&` es un
 * atributo real, y si se llama como uno nativo (`hidden`, `title`, `open`) el browser lo aplica. Una directiva más con
 * el mismo nombre los saca en el pre-link — AngularJS ya leyó los `&` y el template compilado los conserva.
 */
export class OutputAttributes {
  /** Los atributos de los outputs (`{ closed: "&?", shown: "&?afterShown" }` → `["closed", "after-shown"]`). */
  static names(bindings: Record<string, string> | undefined): string[] {
    const names = Object.entries(bindings ?? {}).flatMap(([property, binding]) => {
      const [, mode, alias] = /^([<@&=])\??(\w*)$/.exec(binding) ?? [];
      return mode === "&" ? [(alias || property).replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)] : [];
    });
    return [...new Set(names)];
  }

  /** La directiva a registrar (con el nombre de la declaración), o `undefined` si no tiene outputs. */
  static directive(
    bindings: Record<string, string> | undefined,
    restrict: string,
    requiredTag?: string,
  ): (() => angular.IDirective) | undefined {
    const names = OutputAttributes.names(bindings);
    if (names.length === 0) return undefined;
    const tag = requiredTag?.toLowerCase();
    return () => ({
      restrict,
      link: {
        pre: (_scope: angular.IScope, element: angular.IAugmentedJQuery) => {
          const host = element[0] as Element;
          if (tag && host.localName !== tag) return;
          for (const name of names) host.removeAttribute(name);
        },
      },
    });
  }
}
