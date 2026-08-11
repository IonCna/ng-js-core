import angular, {
  type IController,
  type IDirective,
  type IDirectiveCompileFn,
  type IScope,
  type ITranscludeFunction,
} from "angular";
import type { ContextObject } from "@/core/abstracts";
import { EmbeddedViewRef } from "@/core/refs";

export class TemplateRef<C = ContextObject> implements IController {
  private declarations!: Map<string, string>;
  private static DECLARATION_PREFIX = "let";

  constructor(
    private $transclude: ITranscludeFunction,
    private $scope: IScope,
  ) {}

  protected registerDeclarationMap(map: Map<string, string>) {
    this.declarations = map;
  }

  public createEmbeddedView(context: C, scope?: IScope): EmbeddedViewRef<C> {
    const targetScope = (scope ?? this.$scope).$new();
    const locals: Record<string, string> = Object.create(null);

    angular.extend(locals, context);

    for (const [localName, key] of this.declarations) {
      angular.extend(targetScope, {
        [localName]: locals[key],
      });
    }

    return new EmbeddedViewRef(context, targetScope, this.$transclude);
  }

  static get $name() {
    return "ngTemplate";
  }

  static get $inject() {
    return ["$transclude", "$scope"];
  }

  private static compileFn: IDirectiveCompileFn = (_el, attrs) => {
    const declarationMap = new Map<string, string>();

    for (const [name, value] of Object.entries(attrs)) {
      if (!name.startsWith(TemplateRef.DECLARATION_PREFIX)) continue;

      const start = TemplateRef.DECLARATION_PREFIX.length;
      const nameWithoutPrefix = name.slice(start);

      if (!nameWithoutPrefix) continue;

      const [firstChar] = nameWithoutPrefix;
      const [, ...body] = nameWithoutPrefix;

      const normalized = firstChar.toLowerCase() + body.join("");
      if (!normalized.length) continue;

      declarationMap.set(normalized, value || "$implicit");
    }

    return {
      pre: (_scope, _el, _attrs, ctrl) => {
        const templateRef = ctrl as TemplateRef;
        templateRef.registerDeclarationMap(declarationMap);
      },
    };
  };

  static $factory(): IDirective {
    return {
      controller: TemplateRef,
      bindToController: true,
      restrict: "E",
      compile: TemplateRef.compileFn,
      transclude: "element",
    };
  }
}
