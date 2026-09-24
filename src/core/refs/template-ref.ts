import type { IController, IDirective, IDirectiveCompileFn, IScope, ITranscludeFunction } from "angular";
import { Injectable } from "@/core/di/injectable.ts";
import type { ContextObject, EmbeddedViewHost, EmbeddedViewRef } from "@/core/refs/embedded-view-ref.ts";
import { EmbeddedViewRefImpl } from "@/core/refs/embedded-view-ref.ts";

const DECLARATION_PREFIX = "let";

/**
 * Un `<ng-template>`: contenido que no se muestra solo, se instancia con `createEmbeddedView()` (lo hace
 * `ViewContainerRef`, `NgTemplateOutlet`, o quien lo reciba por una query). Token de DI (`@Injectable()`, nombre
 * compilado en `ɵprov`); la implementación es el controller de la directiva nativa `ngTemplate` (`TemplateRefImpl`).
 */
@Injectable()
export abstract class TemplateRef<C = ContextObject> {
  abstract createEmbeddedView(context: C, scope?: IScope, host?: EmbeddedViewHost): EmbeddedViewRef<C>;
}

/**
 * Controller de la directiva `ngTemplate` — se registra a mano en `NativeModule` (`TemplateRefImpl.directive`):
 * necesita `transclude: "element"` y un `compile` para los `let-*`, que un `@Directive` compilado no expresa.
 */
export class TemplateRefImpl<C = ContextObject> extends TemplateRef<C> implements IController {
  static readonly $inject = ["$transclude", "$scope"];

  private declarations = new Map<string, string>();

  constructor(
    private readonly $transclude: ITranscludeFunction,
    private readonly $scope: IScope,
  ) {
    super();
  }

  /** Llamado por `compileNgTemplate` (el `pre`-link) al parsear los atributos `let-*` — nadie más lo llama. */
  registerDeclarations(declarations: ReadonlyMap<string, string>): void {
    this.declarations = new Map(declarations);
  }

  /**
   * `let-item="clave"` → dentro de la vista embebida, `item` resuelve a
   * `context.clave` (`"$implicit"` si no se puso valor).
   *
   * La variable se define como **getter en vivo** sobre el objeto `context`, no
   * como copia de valor: si el consumidor muta `context.clave` in-place (patrón
   * de `NgbRating`, `NgbCarousel`, …), el diget de la vista lo refleja — igual
   * que Angular, donde el contexto se pasa por referencia.
   */
  createEmbeddedView(context: C, scope?: IScope, host?: EmbeddedViewHost): EmbeddedViewRefImpl<C> {
    const targetScope = (scope ?? this.$scope).$new();
    const source = (context ?? {}) as Record<string, unknown>;

    for (const [localName, key] of this.declarations) {
      Object.defineProperty(targetScope, localName, {
        get: () => source[key],
        configurable: true,
        enumerable: true,
      });
    }

    return new EmbeddedViewRefImpl(context, targetScope, this.$transclude, host);
  }

  static directive(): IDirective {
    return {
      controller: TemplateRefImpl,
      bindToController: true,
      restrict: "E",
      compile: compileNgTemplate,
      transclude: "element",
    };
  }
}

const compileNgTemplate: IDirectiveCompileFn = (_element, attrs) => {
  const declarations = new Map<string, string>();

  for (const [name, value] of Object.entries(attrs)) {
    if (!name.startsWith(DECLARATION_PREFIX)) continue;

    const rest = name.slice(DECLARATION_PREFIX.length);
    if (!rest) continue;

    const localName = rest[0].toLowerCase() + rest.slice(1);
    if (!localName) continue;

    declarations.set(localName, (value as string) || "$implicit");
  }

  return {
    pre: (_scope, _element, _attrs, ctrl) => {
      (ctrl as TemplateRefImpl<unknown>).registerDeclarations(declarations);
    },
  };
};
