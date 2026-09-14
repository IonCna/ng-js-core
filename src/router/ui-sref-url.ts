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
 * Decora `uiSrefDirective` para reescribir una `ui-sref` en forma URL a la forma
 * `estado(params)` **antes** del `link` original. `uiSref` parsea el nombre del
 * estado una sola vez y no lo watchea (ver `@uirouter/angularjs` /
 * `stateDirectives.js`), así que alcanza con un reemplazo de un tiro; la forma
 * dinámica (`[routerLink]="['/x', id]"`) la sigue armando el codemod. El resto de
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
            if (typeof attrs.uiSref === "string" && attrs.uiSref.trim().startsWith("/")) {
              attrs.uiSref = urlToStateRef($injector.get<UiRouterLike>("$uiRouter"), attrs.uiSref);
            }
            return originalLink(scope, element, attrs, ...rest);
          };
      }
      return $delegate;
    },
  ]);
}
