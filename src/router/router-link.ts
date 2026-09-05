import type { StateService, TransitionService, UrlService } from "@uirouter/angularjs";
import type { IAttributes, IAugmentedJQuery, IDirective, ILocationService, IScope } from "angular";

/**
 * `routerLink` / `routerLinkActive` — se integran con UI-Router (`$urlService.match`
 * → state + params, `$state.href`/`$state.go`/`$state.includes`), no solo con la URL.
 *
 * Autoría en runtime (sin CLI): el valor es una **expresión AngularJS**.
 *   `<a router-link="'/about'">` (estático)
 *   `<a router-link="['/about', user.id]">` (dinámico)
 *   `<a router-link="['/about', id]" router-link-active="is-active">`
 */

interface Target {
  stateName: string;
  params: Record<string, unknown>;
}

interface RouterLinkCtrl {
  target: Target | null;
}

function toUrl(value: unknown): string {
  const raw = Array.isArray(value)
    ? value
        .map((s) => String(s))
        .join("/")
        .replace(/\/{2,}/g, "/")
    : String(value ?? "/");
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function matchState($urlService: UrlService, url: string): Target | null {
  try {
    const [path] = url.split("?");
    const result = ($urlService as unknown as { match(parts: unknown): unknown }).match({
      path,
      search: {},
      hash: "",
    }) as { rule?: { type?: string; state?: { name: string } }; match?: Record<string, unknown> } | null;
    if (result?.rule?.type === "STATE" && result.rule.state) {
      return { stateName: result.rule.state.name, params: result.match ?? {} };
    }
  } catch {
    /* sin match → link externo / URL cruda */
  }
  return null;
}

export function routerLinkDirective(
  $urlService: UrlService,
  $state: StateService,
  $location: ILocationService,
): IDirective {
  return {
    restrict: "A",
    controller: function RouterLinkController(this: RouterLinkCtrl) {
      this.target = null;
    },
    link: (scope: IScope, element: IAugmentedJQuery, attrs: IAttributes, ctrl: unknown): void => {
      const linkCtrl = ctrl as RouterLinkCtrl;
      const expr = (attrs as IAttributes & { routerLink: string }).routerLink;

      const resolve = (): { url: string; target: Target | null } => {
        const url = toUrl(scope.$eval(expr));
        return { url, target: matchState($urlService, url) };
      };

      const update = (): void => {
        const { url, target } = resolve();
        linkCtrl.target = target;
        const href = target ? ($state.href(target.stateName, target.params) ?? url) : url;
        element.attr("href", href);
      };

      scope.$watch(expr, update, true);
      update();

      element.on("click", (rawEvent: unknown) => {
        const event = rawEvent as MouseEvent;
        // button undefined (evento sintético) o 0 = click primario.
        if ((event.button ?? 0) !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault?.();
        const { url, target } = resolve();
        scope.$apply(() => {
          if (target) $state.go(target.stateName, target.params);
          else $location.url(url);
        });
      });
    },
  };
}
routerLinkDirective.$inject = ["$urlService", "$state", "$location"];

export function routerLinkActiveDirective($state: StateService, $transitions: TransitionService): IDirective {
  return {
    restrict: "A",
    require: ["routerLinkActive", "?routerLink"],
    controller: function RouterLinkActiveController() {},
    link: (scope: IScope, element: IAugmentedJQuery, attrs: IAttributes, ctrls: unknown): void => {
      const linkCtrl = (ctrls as [unknown, RouterLinkCtrl | undefined])[1];
      const typed = attrs as IAttributes & { routerLinkActive: string; routerLinkActiveExact?: string };
      const cssClass = String(typed.routerLinkActive ?? "").trim();
      if (!cssClass) return;
      // `<a ... router-link-active-exact>` → match exacto (`$state.is`) en vez de prefijo (`$state.includes`).
      const exact = typed.routerLinkActiveExact !== undefined;

      const update = (): void => {
        const target = linkCtrl?.target;
        const active = target
          ? Boolean(
              exact ? $state.is(target.stateName, target.params) : $state.includes(target.stateName, target.params),
            )
          : false;
        element.toggleClass(cssClass, active);
      };

      const off = $transitions.onSuccess({}, update);
      scope.$on("$destroy", () => off());
      update();
    },
  };
}
routerLinkActiveDirective.$inject = ["$state", "$transitions"];
