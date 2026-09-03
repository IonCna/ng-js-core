import angular, { type IRootScopeService } from "angular";
import { type ApplicationRef, ApplicationRefImpl } from "@/core/abstractions/application-ref";
import { createNgDigestZone } from "@/platform-browser/ng-digest-zone";

export type ApplicationConfig = {
  /** Extra AngularJS module names to load alongside `ng.common`. */
  providers?: string[];
};

const APP_MODULE_NAME = "ngjsApplication";

/**
 * Boots an AngularJS application the way Angular's `bootstrapApplication` does:
 * resolves a host element for `rootComponent`, runs `angular.bootstrap` inside a
 * digest-bridged zone (see {@link createNgDigestZone}) and returns the shared
 * {@link ApplicationRef} once the root component is attached.
 */
export async function bootstrapApplication(
  rootComponent: string,
  options: ApplicationConfig = {},
): Promise<ApplicationRef> {
  if (typeof Zone === "undefined") {
    throw new Error('Zone.js no está cargado: importá "zone.js" antes de bootstrapApplication');
  }

  await documentReady();

  angular.module(APP_MODULE_NAME, ["ng.common", ...(options.providers ?? [])]);

  const host = resolveRootElement(rootComponent);

  let injector!: angular.auto.IInjectorService;
  let rootScope: IRootScopeService | undefined;
  const digestZone = createNgDigestZone(() => rootScope);

  digestZone.run(() => {
    injector = angular.bootstrap(host, [APP_MODULE_NAME], { strictDi: false });
  });

  rootScope = injector.get<IRootScopeService>("$rootScope");

  const appRef = injector.get<ApplicationRef>(ApplicationRefImpl.$name);
  await digestZone.run(() => appRef.bootstrap(rootComponent, { hostElement: host }));

  return appRef;
}

function documentReady(): Promise<void> {
  if (document.readyState !== "loading") return Promise.resolve();

  return new Promise((resolve) => {
    document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
  });
}

function resolveRootElement(rootComponent: string): Element {
  const tagName = toKebabCase(rootComponent);
  const existing = document.querySelector(tagName);
  if (existing) return existing;

  const created = document.createElement(tagName);
  document.body.appendChild(created);
  return created;
}

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}
