import "reflect-metadata";
import "zone.js";
import "@uirouter/angularjs";
import type { StateProvider } from "@uirouter/angularjs";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { Component } from "@/core/metadata/component.ts";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { ConfigProviderFactory } from "@/core/platform/config-providers.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootstrapModuleRuntime } from "@/runtime/index.ts";

/**
 * Spike: probar que `lazyLoad` de UI-Router + `import()` nativo de un archivo ESM
 * funciona con nuestro approach (registro manual vía `stateRegistry`, sin
 * devolver `{ states }`). Si esto pasa, `loadChildren` es viable en runtime.
 */

@Component({ selector: "spike-root", controllerAs: "$", template: "<ui-view></ui-view>" })
class SpikeRoot {}

@Component({ selector: "lazy-shell", template: "<ui-view></ui-view>" })
class LazyShell {}

const camel = (s: string) => s.replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase());

interface StateRegistryLike {
  register(state: Record<string, unknown>): unknown;
  deregister(name: string): unknown;
}
interface TransitionLike {
  router: { stateRegistry: StateRegistryLike };
}

let seq = 0;
function spikeRouterModule(): angular.IModule {
  const config = ($stateProvider: StateProvider) => {
    // Future state: el sufijo `.**` hace que `/lazy` matchee como prefijo
    // (`/lazy/users`, `/lazy/users/42`, …) y dispare `lazyLoad` aunque los hijos
    // no existan todavía.
    $stateProvider.state({
      name: "lazy.**",
      url: "/lazy",
      // biome-ignore lint/suspicious/noExplicitAny: contrato lazyLoad de UI-Router
      lazyLoad: (async (transition: TransitionLike) => {
        // --- lo que nos preocupaba: import() de un módulo ESM ---
        const ns = await import("./lazy-children.routes.ts");
        const childRoutes = ns.CHILD_ROUTES; // lectura del namespace (congelado) — ok

        const registrar = ConfigProviderFactory.current;
        if (!registrar) throw new Error("spike: sin config-providers");
        const registry = transition.router.stateRegistry;

        childRoutes.forEach((route, i) => {
          const def = getComponentDef(route.component as Function);
          if (!def) throw new Error("spike: ruta sin @Component");
          const name = camel(def.selector);
          registrar.$compile.component(name, {
            controller: route.component as never,
            template: def.template,
            controllerAs: def.controllerAs,
          });
          registry.register({
            name: `lazy.child${i}`,
            url: route.path === "users" ? "/users" : "/users/:id",
            component: name,
          });
        });

        registry.deregister("lazy.**"); // quitar el future state
        registry.register({ name: "lazy", url: "/lazy", component: "lazyShell" });
        // biome-ignore lint/suspicious/noExplicitAny: idem
      }) as any,
    });
  };
  config.$inject = ["$stateProvider"];
  return angular.module(`spike.router.${seq++}`, ["ui.router"]).config(config);
}

@NgModule({ imports: [CommonModule, spikeRouterModule()], declarations: [SpikeRoot, LazyShell] })
class AppModule {}

async function navigate(url: string, injector: angular.auto.IInjectorService): Promise<void> {
  const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");
  const $location = injector.get<angular.ILocationService>("$location");
  // biome-ignore lint/suspicious/noExplicitAny: $urlRouter no está en @types/angular
  const $urlRouter = injector.get<any>("$urlRouter");

  $location.url(url);
  for (let i = 0; i < 15; i++) {
    $urlRouter.sync(); // re-matchea la URL contra los estados (agarra los recién registrados)
    $rootScope.$apply();
    await new Promise((r) => setTimeout(r));
  }
}

describe("spike — UI-Router lazyLoad + ESM import()", () => {
  it("baja un .ts ESM con import() y registra su subárbol de rutas", async () => {
    const host = document.createElement("spike-root");
    document.body.appendChild(host);

    const appRef = await bootstrapModuleRuntime(AppModule, { hostElement: host });
    const injector = appRef.injector as angular.auto.IInjectorService;

    await navigate("/lazy/users", injector);

    expect(host.textContent).toContain("lazy users page");
    appRef.destroy();
  });

  it("una ruta lazy con param (:id) también resuelve", async () => {
    const host = document.createElement("spike-root");
    document.body.appendChild(host);

    const appRef = await bootstrapModuleRuntime(AppModule, { hostElement: host });
    const injector = appRef.injector as angular.auto.IInjectorService;

    await navigate("/lazy/users/42", injector);

    expect(host.textContent).toContain("detail 42");
    appRef.destroy();
  });
});
