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
  static readonly $inject = ["$transclude", "$scope", "$element"];

  /**
   * El `TemplateRef` de cada comentario ancla de `<ng-template>` (`transclude: "element"`). jqLite no guarda `data()`
   * en comentarios, así que `$element.controller("ngTemplate")` no lo encuentra desde otra directiva del mismo
   * `<ng-template>` (`inject(TemplateRef)` en `@Directive({ selector: "ng-template[x]" })`).
   */
  private static readonly byAnchor = new WeakMap<Node, TemplateRefImpl<unknown>>();

  private declarations = new Map<string, string>();

  constructor(
    private readonly $transclude: ITranscludeFunction,
    private readonly $scope: IScope,
    $element?: ArrayLike<Node>,
  ) {
    super();
    const anchor = $element?.[0];
    if (anchor) TemplateRefImpl.byAnchor.set(anchor, this as TemplateRefImpl<unknown>);
  }

  /**
   * El `TemplateRef` del `<ng-template>` en `node` (su comentario ancla). Si otra directiva del mismo `<ng-template>`
   * se construye antes que `ngTemplate` (AngularJS los construye por prioridad y nombre), se devuelve uno que
   * delega en el real al usarse.
   */
  static of<C>(node: Node | undefined): TemplateRef<C> | undefined {
    if (!node) return undefined;
    const existing = TemplateRefImpl.byAnchor.get(node);
    if (existing) return existing as unknown as TemplateRef<C>;
    if (node.nodeType !== 8 || !/ngTemplate/.test(node.nodeValue ?? "")) return undefined;
    return new DeferredTemplateRef<C>(() => TemplateRefImpl.byAnchor.get(node) as unknown as TemplateRef<C> | undefined);
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

const compileNgTemplate: IDirectiveCompileFn = (element, attrs) => {
  // El comentario ancla se reconoce por su texto (`TemplateRefImpl.of`, y el guard de selector que emite el compilador
  // para `ng-template[x]`). Con `debugInfoEnabled(false)` (`ngjs build`) AngularJS lo crea vacío: se le pone acá, en
  // `compile`, para que lo hereden los clones (`ng-repeat`, contenido proyectado).
  const anchor = element[0] as Node | undefined;
  if (anchor?.nodeType === 8 && !/ngTemplate/.test(anchor.nodeValue ?? "")) anchor.nodeValue = " ngTemplate: ";

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

/** `TemplateRef` de un `<ng-template>` cuyo controller `ngTemplate` todavía no se construyó (ver `TemplateRefImpl.of`). */
class DeferredTemplateRef<C> extends TemplateRef<C> {
  constructor(private readonly resolve: () => TemplateRef<C> | undefined) {
    super();
  }

  createEmbeddedView(context: C, scope?: IScope, host?: EmbeddedViewHost): EmbeddedViewRef<C> {
    const target = this.resolve();
    if (!target) throw new Error("TemplateRef: el <ng-template> todavía no se creó.");
    return target.createEmbeddedView(context, scope, host);
  }
}
