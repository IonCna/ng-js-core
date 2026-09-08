import type angular from "angular";
import { bindingsFromDefs } from "@/core/metadata/component-bindings.ts";
import type { StampedComponentDef } from "@/core/metadata/define-component.ts";
import type { StampedDirectiveDef } from "@/core/metadata/directive.ts";
import { type ParsedSelector, parseSelector } from "@/core/metadata/selector-name.ts";

/**
 * Único lugar donde `ComponentDef`/`DirectiveDef` se traducen a lo que AngularJS
 * espera (`.component()`/`.directive()`). Antes esta lógica estaba duplicada
 * entre `runtime/ng-module-runtime.ts` (`@NgModule`) y `compat/registry.ts`
 * (`ngjs-core/compat`) — cada una con sus propios bugs de selector/bindings. Un
 * solo lugar para arreglar y para que las dos vías se comporten igual.
 */

export function computeComponentBindings(def: StampedComponentDef): Record<string, string> {
  return def.bindings ?? bindingsFromDefs(def.inputs, def.outputs);
}

/** `undefined` (deja el `?? true` de siempre) si la directiva no tiene `@Input`/`@Output`. */
function computeDirectiveBindings(def: StampedDirectiveDef): Record<string, string> | undefined {
  if (def.inputs.length === 0 && def.outputs.length === 0) return undefined;
  return bindingsFromDefs(def.inputs, def.outputs);
}

/**
 * Solo para componentes (`.component()`/`buildComponentAsDirective`) cae a
 * `"$ctrl"` — el default nativo de `.component()`, así no cambia nada. Las
 * directivas (`buildDirectiveDefinition`) NO fuerzan este default: si nadie puso
 * `controllerAs`, queda `undefined` — AngularJS no lo auto-defaultea, y forzarlo
 * metería un `$ctrl` en el scope compartido de una directiva sin `controllerAs`.
 */
function resolveComponentControllerAs(own: string | undefined, fromModule: string | undefined): string {
  return own ?? fromModule ?? "$ctrl";
}

/**
 * `controllerAs` de una `@Directive`:
 * - lo explícito de la clase gana siempre;
 * - una directiva **sin template propio pero con `@Input`/`@Output`** necesita un
 *   `identifier` para que AngularJS corra `initializeDirectiveBindings` sobre el
 *   `bindToController`-hash — pero NO el `controllerAs` del `@NgModule` (p.ej.
 *   `"$"`): ese es para los templates de los componentes, y compartido entre
 *   muchas directivas colisiona en el scope (`scope.$` pisado). Se usa el nombre
 *   de registro (`ngbNavPane`), único por tipo de directiva y sin uso en template;
 * - una directiva con template propio sí hereda el `controllerAs` del módulo
 *   (su template puede necesitarlo);
 * - sin bindings y sin template: `undefined` (como antes).
 */
function resolveDirectiveControllerAs(
  def: StampedDirectiveDef,
  registrationName: string,
  moduleControllerAs: string | undefined,
): string | undefined {
  if (def.controllerAs) return def.controllerAs;
  const hasTemplate = Boolean(def.template || def.templateUrl);
  if (hasTemplate) return moduleControllerAs;
  const hasBindings = def.inputs.length > 0 || def.outputs.length > 0;
  return hasBindings ? registrationName : moduleControllerAs;
}

/**
 * Envuelve `compile`/`link` para que, cuando el selector es más que un tag o
 * `[attr]` sueltos (compuesto tipo `button[ngbNavLink]`, o con `:not(...)`), se
 * verifiquen contra el elemento real (`Element.matches`) antes de linkear. Si no
 * matchea, no se linkea nada — pero OJO: AngularJS decide si instancia el
 * `controller` solo por nombre+`restrict` (no por el selector completo), así que
 * esto NO evita que el controller se construya en un elemento que no matchea el
 * selector completo. Es un límite real de AngularJS, no de esta implementación
 * — Angular real sí filtra por selector completo antes de instanciar nada.
 */
function guardLinkFn(fn: angular.IDirectiveLinkFn, refine: string): angular.IDirectiveLinkFn {
  return (scope, instanceElement, instanceAttrs, controller, transcludeFn) => {
    const native = (instanceElement as unknown as ArrayLike<Element>)[0];
    if (native?.matches(refine)) fn(scope, instanceElement, instanceAttrs, controller, transcludeFn);
  };
}

/**
 * El chequeo se hace en LINK (contra el elemento de instancia real), no en
 * `compile` (contra el elemento de template) — más correcto (el nodo final es
 * el que hay que matchear) y evita pelear con las dos firmas distintas de
 * `compile`/`link` de AngularJS.
 */
function guardWithSelector(
  parsed: ParsedSelector,
  compile: angular.IDirectiveCompileFn | undefined,
  link: angular.IDirective["link"],
): Pick<angular.IDirective, "compile" | "link"> {
  if (!parsed.refine) return { compile, link };
  const refine = parsed.refine;

  const guardedCompile: angular.IDirectiveCompileFn = (element, attrs, transclude) => {
    const resolvedLink = compile ? compile(element, attrs, transclude) : link;
    if (!resolvedLink) return undefined;

    if (typeof resolvedLink === "function") return guardLinkFn(resolvedLink, refine);
    return {
      pre: resolvedLink.pre && guardLinkFn(resolvedLink.pre, refine),
      post: resolvedLink.post && guardLinkFn(resolvedLink.post, refine),
    };
  };

  return { compile: guardedCompile, link: undefined };
}

export function buildDirectiveDefinition(
  declaration: Function,
  def: StampedDirectiveDef,
  moduleControllerAs?: string,
): angular.IDirective {
  const parsed = parseSelector(def.selector);
  const { compile, link } = guardWithSelector(parsed, def.compile, def.link);
  return {
    controller: declaration as unknown as angular.Injectable<angular.IControllerConstructor>,
    // Objeto de bindings (no `scope: {}` aislado) — así varias directivas de
    // atributo en el mismo elemento pueden tener cada una sus `@Input`/`@Output`
    // propios sin pelearse por el único scope aislado que AngularJS permite por
    // elemento. `bindToController` como hash es independiente de `scope`.
    bindToController: def.bindToController ?? computeDirectiveBindings(def) ?? true,
    restrict: def.restrict ?? parsed.restrict,
    scope: def.scope,
    require: def.require,
    transclude: def.transclude,
    template: def.template,
    templateUrl: def.templateUrl,
    controllerAs: resolveDirectiveControllerAs(def, parsed.registrationName, moduleControllerAs),
    priority: def.priority,
    terminal: def.terminal,
    compile,
    link,
  };
}

export function buildComponentOptions(
  declaration: Function,
  def: StampedComponentDef,
  moduleControllerAs?: string,
): angular.IComponentOptions {
  return {
    controller: declaration as unknown as angular.Injectable<angular.IControllerConstructor>,
    template: def.template,
    templateUrl: def.templateUrl,
    controllerAs: resolveComponentControllerAs(def.controllerAs, moduleControllerAs),
    require: def.require,
    bindings: computeComponentBindings(def),
    transclude: def.transclude ?? (def.template?.includes("<ng-content") ? true : undefined),
  };
}

/**
 * Mismo desugar que hace `.component()` internamente (`scope: {}`,
 * `bindToController: bindings`, `restrict: 'E'`) pero con el `restrict`/refine
 * reales del selector — para selectores de atributo/compuestos (`[ngbNavOutlet]`,
 * `button[ngbNavLink]`) que `.component()` NUNCA puede representar (siempre
 * registra como elemento).
 */
export function buildComponentAsDirective(
  declaration: Function,
  def: StampedComponentDef,
  moduleControllerAs?: string,
): angular.IDirective {
  const parsed = parseSelector(def.selector);
  const { compile, link } = guardWithSelector(parsed, undefined, undefined);
  return {
    controller: declaration as unknown as angular.Injectable<angular.IControllerConstructor>,
    controllerAs: resolveComponentControllerAs(def.controllerAs, moduleControllerAs),
    template: def.template,
    templateUrl: def.templateUrl,
    transclude: def.transclude ?? (def.template?.includes("<ng-content") ? true : undefined),
    scope: {},
    bindToController: computeComponentBindings(def),
    restrict: parsed.restrict,
    require: def.require,
    compile,
    link,
  };
}

export { parseSelector };
