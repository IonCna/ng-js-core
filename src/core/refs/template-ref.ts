import angular, { type IController, type IDirective, type IDirectiveCompileFn, type IScope, type ITranscludeFunction } from "angular";
import { Directive } from "@/core/metadata/directive.ts";
import type { ContextObject } from "@/core/refs/embedded-view-ref.ts";
import { EmbeddedViewRefImpl } from "@/core/refs/embedded-view-ref.ts";

const DECLARATION_PREFIX = "let";

/**
 * `@Directive` acá es solo metadata (igual que en el resto del framework —
 * ver CONCEPTOS "Un modelo de datos, varios frentes"): NO registra nada en
 * AngularJS por su cuenta. El registro real es `TemplateRef.$factory()`,
 * llamado a mano (`module.directive('ngTemplate', TemplateRef.$factory)`),
 * igual que cualquier otro componente/directiva de este proyecto.
 */
@Directive({ selector: "ng-template" })
export class TemplateRef<C = ContextObject> implements IController {
  static readonly $inject = ["$transclude", "$scope"];

  private declarations = new Map<string, string>();

  constructor(
    private readonly $transclude: ITranscludeFunction,
    private readonly $scope: IScope,
  ) {}

  /** Llamado por `compileNgTemplate` (el `pre`-link) al parsear los atributos `let-*` — nadie más lo llama. */
  registerDeclarations(declarations: ReadonlyMap<string, string>): void {
    this.declarations = new Map(declarations);
  }

  /** `let-item="clave"` → dentro de la vista embebida, `item` resuelve a `context.clave` (`"$implicit"` si no se puso valor). */
  createEmbeddedView(context: C, scope?: IScope): EmbeddedViewRefImpl<C> {
    const targetScope = (scope ?? this.$scope).$new();
    const locals: Record<string, unknown> = Object.create(null);
    angular.extend(locals, context);

    for (const [localName, key] of this.declarations) {
      angular.extend(targetScope, { [localName]: locals[key] });
    }

    return new EmbeddedViewRefImpl(context, targetScope, this.$transclude);
  }

  static $factory(): IDirective {
    return {
      controller: TemplateRef,
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
      (ctrl as TemplateRef<unknown>).registerDeclarations(declarations);
    },
  };
};
