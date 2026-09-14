import angular from "angular";
import { routerRegistry } from "@/router/router-registry.ts";

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
 */
export function urlToStateRef(uiRouter: UiRouterLike, raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.includes("{{")) return raw;

  const [beforeHash, hash = ""] = trimmed.split("#");
  const [path, search] = beforeHash.split("?");

  const matched = uiRouter.urlService.match({ path, search: parseSearch(search), hash });
  if (matched && matched.rule.type === "STATE" && matched.rule.state) {
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
              const literal = raw.trim().startsWith("/") ? raw : evalDynamicRef(scope, raw);
              if (literal !== undefined) {
                attrs.uiSref = urlToStateRef($injector.get<UiRouterLike>("$uiRouter"), literal);
              }
            }
            return originalLink(scope, element, attrs, ...rest);
          };
      }
      return $delegate;
    },
  ]);
}
