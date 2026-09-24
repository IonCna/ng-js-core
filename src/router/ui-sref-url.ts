import angular from "angular";
import { LocationStrategy } from "@/common/location/index.ts";
import { injectionTokenName } from "@/core/di/injector.ts";
import { Router } from "@/router/router.ts";
import { routerRegistry } from "@/router/router-registry.ts";
import {
  type LazyLoadContext,
  type LazyRouteEntry,
  loadLazyChainForUrl,
  type StateRegistryLike,
  unloadedLazyEntryForState,
} from "@/router/state-translator.ts";

/**
 * `ui-sref` acepta, además del state name nativo de UI-Router, la forma **URL**
 * (`/algo/5?tab=a#top`) — la misma sintaxis que `routerLink` en Angular. Así el
 * template se escribe con paths y no hace falta el codemod para los links
 * estáticos, y `path` (de la `Route`) y `ui-sref` matchean por construcción: los
 * dos se resuelven contra la config que armó `state-translator.ts`.
 *
 * Traducción en dos pasos:
 *  1. `urlService.match()` — el matcher propio de UI-Router: para states con `url`
 *     propia devuelve `{ state, params }` con los params ya tipados.
 *  2. `routerRegistry.pathToName` — fallback para states sin `url` (componentless,
 *     `path: ""`), sin params.
 */

interface StateMatchRule {
  type?: string;
  state?: { name: string };
}

interface UrlMatchResult {
  rule: StateMatchRule;
  match: Record<string, unknown>;
}

interface UrlServiceLike {
  match(parts: { path: string; search?: Record<string, string>; hash?: string }): UrlMatchResult | undefined;
}

export interface UiRouterLike {
  urlService: UrlServiceLike;
  stateRegistry?: StateRegistryLike & { onStatesChanged(listener: () => void): () => void };
}

/** `"a=1&b=2"` → `{ a: "1", b: "2" }` (vacío → `{}`). */
function parseSearch(search: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of (search ?? "").split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const key = decodeURIComponent(eq < 0 ? pair : pair.slice(0, eq));
    out[key] = eq < 0 ? "" : decodeURIComponent(pair.slice(eq + 1));
  }
  return out;
}

/**
 * `"/users/5?tab=a#top"` → `'users.id({"id":"5"})'` (forma que `uiSref` parsea con
 * `parseStateRef` y `scope.$eval`ua — un literal JSON eval-úa a sí mismo).
 * Si `raw` no empieza con `/` ya es un state ref nativo → se devuelve tal cual.
 * Si quedó interpolación `{{ }}` sin resolver, o nada matchea, también se devuelve
 * crudo — misma degradación que `uiSref` ante un nombre inválido.
 * Si la URL cae en un módulo lazy **sin cargar** (matchea un future state `x.**`)
 * también se devuelve cruda: ese estado desaparece al cargar, así que no sirve como
 * destino — el decorator la maneja como link lazy (`LazyUrlLink`).
 */
export function urlToStateRef(uiRouter: UiRouterLike, raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.includes("{{")) return raw;

  const [beforeHash, hash = ""] = trimmed.split("#");
  const [path, search] = beforeHash.split("?");

  const matched = uiRouter.urlService.match({ path, search: parseSearch(search), hash });
  if (matched && matched.rule.type === "STATE" && matched.rule.state) {
    if (matched.rule.state.name.endsWith(".**")) return raw;
    return `${matched.rule.state.name}(${angular.toJson(matched.match ?? {})})`;
  }

  const name = routerRegistry.pathToName.get(path.replace(/^\/+|\/+$/g, ""));
  return name ?? raw;
}

/**
 * `ui-sref` dinámico (`[routerLink]="tab.to"` de Angular, típicamente dentro de
 * un `ng-repeat`): una expresión de scope que devuelve un path (`"/x/y"`), NO
 * un nombre de estado ni interpolación `{{ }}` (`uiSref` nativo no evalúa su
 * atributo como expresión — solo lee texto literal u observa `{{ }}`, así que
 * `ui-sref="tab.to"` sin este soporte quedaría apuntando al estado inexistente
 * `"tab.to"`, un no-op silencioso). Se evalúa **una sola vez** (mismo timing
 * que la forma estática — ver abajo), igual que Angular no re-evalúa
 * `[routerLink]` como binding watcheado para el HREF ya resuelto en cada
 * ciclo. Si la expresión no evalúa a un string que empiece con `/`, se deja
 * el atributo intacto (nombre de estado literal, u otra cosa que el `uiSref`
 * nativo sepa resolver).
 */
function evalDynamicRef(scope: angular.IScope, expr: string): string | undefined {
  if (expr.includes("{{")) return undefined; // interpolación `{{ }}`: la maneja `uiSref` nativo vía `$observe`.
  try {
    const value = scope.$eval(expr);
    return typeof value === "string" && value.trim().startsWith("/") ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Decora `uiSrefDirective` para reescribir una `ui-sref` en forma URL a la forma
 * `estado(params)` **antes** del `link` original. `uiSref` parsea el nombre del
 * estado una sola vez y no lo watchea (ver `@uirouter/angularjs` /
 * `stateDirectives.js`), así que alcanza con un reemplazo de un tiro — tanto
 * para la forma estática (`ui-sref="/algo"`, texto literal) como para la
 * dinámica (`ui-sref="tab.to"`, expresión — ver `evalDynamicRef`). El resto de
 * la mecánica de `uiSref` (href, click con modificadores, `target`, integración
 * con `ui-sref-active`) queda intacta porque delegamos en el `link` real con el
 * ref ya traducido.
 */
export function decorateUiSrefWithUrl($provide: angular.auto.IProvideService): void {
  $provide.decorator("uiSrefDirective", [
    "$delegate",
    "$injector",
    ($delegate: angular.IDirective[], $injector: angular.auto.IInjectorService): angular.IDirective[] => {
      for (const directive of $delegate) {
        const originalLink = directive.link as ((...args: unknown[]) => unknown) | undefined;
        if (!originalLink) continue;

        directive.compile =
          (): angular.IDirectiveLinkFn =>
          (scope, element, attrs, ...rest) => {
            const raw = attrs.uiSref;
            if (typeof raw === "string" && raw.trim()) {
              const uiRouter = $injector.get<UiRouterLike>("$uiRouter");
              const link = () => originalLink(scope, element, attrs, ...rest);
              const literal = raw.trim().startsWith("/") ? raw : evalDynamicRef(scope, raw);
              if (literal !== undefined) {
                const translated = urlToStateRef(uiRouter, literal);
                if (translated === literal && LazyUrlLink.targetsUnloadedBranch(uiRouter, literal)) {
                  new LazyUrlLink(scope, element, attrs, literal, uiRouter, $injector, link).start();
                  return;
                }
                attrs.uiSref = translated;
              } else {
                LinkIntentPreload.forStateRef(scope, element, raw, uiRouter, $injector);
              }
            }
            return originalLink(scope, element, attrs, ...rest);
          };
      }
      return $delegate;
    },
  ]);
}

const INTENT_EVENTS = ["mouseenter", "focus", "touchstart"] as const;

/**
 * Listeners de intención con `addEventListener` nativo (no jqLite: su `mouseenter`
 * se emula sobre `mouseover`). Devuelve la función que los quita.
 */
function onIntent(element: angular.IAugmentedJQuery, handler: () => void): () => void {
  const target = element[0] as HTMLElement | undefined;
  if (!target) return () => undefined;
  for (const event of INTENT_EVENTS) target.addEventListener(event, handler, { passive: true });
  return () => {
    for (const event of INTENT_EVENTS) target.removeEventListener(event, handler);
  };
}

function lazyContext(uiRouter: UiRouterLike, $injector: angular.auto.IInjectorService): LazyLoadContext | undefined {
  if (!uiRouter.stateRegistry) return undefined;
  return { stateRegistry: uiRouter.stateRegistry, $injector };
}

/**
 * Link `ui-sref` **por nombre** a un estado dentro de un módulo lazy sin cargar
 * (`ui-sref="admin.users_id({id: 1})"`): UI-Router no puede armar su `href` hasta que
 * el estado exista. Ante la intención del usuario (`mouseenter`/`focus`/`touchstart`)
 * se baja esa rama (memo compartido con navegación/preload); `uiSref` recalcula el
 * `href` solo (`onStatesChanged`). No se baja nada por el mero render del link.
 */
class LinkIntentPreload {
  private readonly off: (() => void)[] = [];

  private constructor(
    private readonly element: JQLite,
    private readonly stateName: string,
    private readonly context: LazyLoadContext,
  ) {}

  static forStateRef(
    scope: angular.IScope,
    element: JQLite,
    raw: string,
    uiRouter: UiRouterLike,
    $injector: angular.auto.IInjectorService,
  ): void {
    const stateName = raw
      .trim()
      .match(/^([^(]*?)\s*(\(|$)/)?.[1]
      ?.trim();
    // Relativos (`.hijo`, `^.x`) y expresiones: fuera — no hay forma de saber el destino absoluto acá.
    if (!stateName || /^[.^]/.test(stateName) || raw.includes("{{")) return;
    const context = lazyContext(uiRouter, $injector);
    if (!context || !unloadedLazyEntryForState($injector, stateName)) return;

    const preload = new LinkIntentPreload(element, stateName, context);
    preload.listen();
    scope.$on("$destroy", () => preload.dispose());
  }

  private listen(): void {
    this.off.push(onIntent(this.element, () => void this.loadChain()));
  }

  /** Baja la rama y, si el estado vive en una rama lazy anidada, la siguiente. */
  private async loadChain(): Promise<void> {
    this.dispose();
    const loaded = new Set<LazyRouteEntry>();
    for (let depth = 0; depth < 10; depth++) {
      const entry: LazyRouteEntry | undefined = unloadedLazyEntryForState(this.context.$injector, this.stateName);
      if (!entry || loaded.has(entry)) return;
      loaded.add(entry);
      try {
        await entry.load(this.context);
      } catch {
        this.listen(); // falló la carga: se reintenta en la próxima intención
        return;
      }
    }
  }

  dispose(): void {
    for (const off of this.off.splice(0)) off();
  }
}

type JQLite = angular.IAugmentedJQuery;

/**
 * Link `ui-sref` en **forma URL** a un path dentro de un módulo lazy sin cargar
 * (`ui-sref="/admin/users/7"`). Mientras el estado destino no existe:
 *  - `href` = el path real (vía `LocationStrategy`, así respeta hash/base href);
 *  - click (izquierdo, sin modificadores, sin `target`) → `Router.navigateByUrl`;
 *  - intención (`mouseenter`/`focus`/`touchstart`) → baja la rama.
 * Apenas la URL resuelve a un estado real (`onStatesChanged`), se "promueve" a un
 * `ui-sref` normal (el `link` original de UI-Router) — así `ui-sref-active` y el
 * resto de la mecánica nativa funcionan igual que en cualquier otro link.
 */
class LazyUrlLink {
  private readonly off: (() => void)[] = [];
  private promoted = false;

  constructor(
    private readonly scope: angular.IScope,
    private readonly element: JQLite,
    private readonly attrs: angular.IAttributes,
    private readonly url: string,
    private readonly uiRouter: UiRouterLike,
    private readonly $injector: angular.auto.IInjectorService,
    private readonly nativeLink: () => unknown,
  ) {}

  /** `true` si la URL matchea un future state (rama lazy sin cargar). */
  static targetsUnloadedBranch(uiRouter: UiRouterLike, url: string): boolean {
    const [beforeHash, hash = ""] = url.trim().split("#");
    const [path, search] = beforeHash.split("?");
    const matched = uiRouter.urlService.match({ path, search: parseSearch(search), hash });
    return Boolean(matched?.rule.type === "STATE" && matched.rule.state?.name.endsWith(".**"));
  }

  start(): void {
    if (this.element[0]?.tagName === "A") this.attrs.$set("href", this.href());

    const onClick = (event: JQueryEventObject) => this.onClick(event);
    this.element.on("click", onClick);
    this.off.push(() => this.element.off("click", onClick));

    this.off.push(onIntent(this.element, () => void this.preload()));

    const offStates = this.uiRouter.stateRegistry?.onStatesChanged(() => this.promoteIfResolvable());
    // Diferido: UI-Router notifica con `listeners.forEach`; quitarse de la lista en pleno
    // recorrido corre el array y se saltea al listener siguiente (p.ej. otro `ui-sref`).
    if (offStates) this.off.push(() => void Promise.resolve().then(offStates));
    this.scope.$on("$destroy", () => this.dispose());
  }

  private href(): string {
    const name = injectionTokenName(LocationStrategy);
    if (!this.$injector.has(name)) return this.url;
    return this.$injector.get<LocationStrategy>(name).prepareExternalUrl(this.url);
  }

  private onClick(event: JQueryEventObject): void {
    const mouse = event as unknown as MouseEvent;
    const modified = mouse.button > 0 || mouse.ctrlKey || mouse.metaKey || mouse.shiftKey || mouse.altKey;
    if (modified || this.element.attr("target")) return; // el navegador abre el `href` real
    event.preventDefault();
    void this.$injector.get<Router>(injectionTokenName(Router)).navigateByUrl(this.url);
  }

  private async preload(): Promise<void> {
    const context = lazyContext(this.uiRouter, this.$injector);
    const [path] = this.url.trim().split(/[?#]/);
    if (context) await loadLazyChainForUrl(path, this.uiRouter.urlService, context).catch(() => undefined);
  }

  /** Cuando la URL ya resuelve a un estado real: se entrega al `ui-sref` nativo. */
  private promoteIfResolvable(): void {
    if (this.promoted) return;
    const translated = urlToStateRef(this.uiRouter, this.url);
    if (translated === this.url) return;

    this.promoted = true;
    this.dispose();
    this.attrs.uiSref = translated;
    this.nativeLink();
  }

  private dispose(): void {
    for (const off of this.off.splice(0)) off();
  }
}
