import angular from "angular";
import { ConfigProviderFactory } from "@/core/platform/config-providers.ts";
import type { Routes } from "@/router/route.ts";
import { routerRegistry } from "@/router/router-registry.ts";

type InvokeQueueEntry = [providerName: string, method: string, args: unknown[]];

/** Internals de `angular.module` que `loadModules` recorre (no tipados en `@types/angular`). */
interface ModuleInternals extends angular.IModule {
  _invokeQueue: InvokeQueueEntry[];
  _configBlocks: InvokeQueueEntry[];
  _runBlocks: angular.Injectable<Function>[];
}

interface InjectorWithModules extends angular.auto.IInjectorService {
  modules: Record<string, angular.IModule>;
}

/**
 * Carga un `@NgModule` compilado (el de `loadChildren: () => import(...).then(m => m.XModule)`) en una app **ya
 * arrancada**. El archivo del módulo ya registró su `angular.module` al evaluarse (`ɵmod.id`); AngularJS no carga
 * módulos después del bootstrap, así que se replica su `loadModules` sobre el injector vivo: por cada módulo del
 * grafo que falte, su `_invokeQueue` y `_configBlocks` contra el *provider injector* (capturado por `NativeModule`) y
 * al final sus `_runBlocks` (entre ellos, el que instancia la clase del `@NgModule`).
 *
 * Los módulos de `RouterModule.forChild` **no** se corren (su `.config` registraría los estados en la raíz): se
 * marcan cargados y sus `Routes` se devuelven, para que `loadChildren` las traduzca rooteadas en la ruta padre.
 *
 * AngularJS tiene UN injector: los `providers` del módulo lazy quedan para toda la app (en Angular serían del
 * injector de la rama). Las `declarations` son globales: un nombre repetido es error.
 */
export class LazyNgModuleLoader {
  private readonly routes: Routes = [];

  constructor(private readonly $injector: InjectorWithModules) {}

  load(moduleType: Function): Routes {
    const registrar = ConfigProviderFactory.current;
    if (!registrar) throw new Error("loadChildren: no hay providers de config capturados (¿falta el bootstrap?).");
    const id = (moduleType as { ɵmod?: { id: string } }).ɵmod?.id;
    if (!id) throw new Error(`loadChildren: "${moduleType.name}" no es un @NgModule compilado.`);

    this.collectRoutes(id, new Set());
    const newModules: ModuleInternals[] = [];
    this.collectNewModules(id, newModules);

    const runBlocks: angular.Injectable<Function>[] = [];
    for (const module of newModules) {
      this.assertNoDeclarationCollisions(module);
      this.runQueue(module._invokeQueue, registrar.$providerInjector);
      this.runQueue(module._configBlocks, registrar.$providerInjector);
      runBlocks.push(...module._runBlocks);
    }
    for (const block of runBlocks) this.$injector.invoke(block);
    return this.routes;
  }

  /** `Routes` de todos los `forChild` del grafo de imports — también de módulos ya cargados (Angular junta `ROUTES`). */
  private collectRoutes(name: string, visited: Set<string>): void {
    if (visited.has(name)) return;
    visited.add(name);
    const childRoutes = routerRegistry.childRoutesOf(name);
    if (childRoutes) {
      this.routes.push(...childRoutes);
      return;
    }
    for (const required of angular.module(name).requires) this.collectRoutes(required, visited);
  }

  /** Módulos del grafo que la app no tiene cargados, en post-orden (imports primero); los marca cargados. */
  private collectNewModules(name: string, out: ModuleInternals[]): void {
    if (this.$injector.modules[name]) return;
    const module = angular.module(name) as ModuleInternals;
    this.$injector.modules[name] = module;
    if (routerRegistry.childRoutesOf(name)) return;
    for (const required of module.requires) this.collectNewModules(required, out);
    out.push(module);
  }

  /**
   * En AngularJS los nombres son globales: un componente o pipe lazy con un nombre ya registrado se aplicaría encima
   * del existente (doble template) o lo pisaría para toda la app — se corta con un error claro.
   */
  private assertNoDeclarationCollisions(module: ModuleInternals): void {
    for (const [providerName, method, args] of module._invokeQueue) {
      const name = args[0];
      if (typeof name !== "string") continue;
      const isComponent = providerName === "$compileProvider" && method === "component";
      const isPipe = providerName === "$filterProvider" && method === "register";
      const registered = isComponent ? `${name}Directive` : isPipe ? `${name}Filter` : undefined;
      if (registered && this.$injector.has(registered)) {
        throw new Error(
          `loadChildren: el @NgModule lazy "${module.name}" declara ${isComponent ? "un componente" : "un pipe"} "${name}" que ya existe en la app. ` +
            "En AngularJS las declarations son globales — renombralo o movelo a un módulo compartido.",
        );
      }
    }
  }

  private runQueue(queue: InvokeQueueEntry[], providerInjector: angular.auto.IInjectorService): void {
    for (const [providerName, method, args] of queue) {
      const provider = providerInjector.get<Record<string, (...values: unknown[]) => unknown>>(providerName);
      provider[method]!.apply(provider, args);
    }
  }
}
