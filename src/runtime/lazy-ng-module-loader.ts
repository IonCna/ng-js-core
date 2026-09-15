import angular from "angular";
import type { Provider } from "@/core/di/provider.ts";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import { getDirectiveDef } from "@/core/metadata/directive.ts";
import { getNgModuleDef, ngModuleInjectionName } from "@/core/metadata/ng-module.ts";
import { ConfigProviderFactory } from "@/core/platform/config-providers.ts";
import type { Routes } from "@/router/route.ts";
import { routerRegistry } from "@/router/router-registry.ts";
import type { ElementInjectorNode } from "@/runtime/element-injector-node.ts";
import { type NgModuleScope, ngModuleScopes, ngModuleTypeOf } from "@/runtime/ng-module-instances.ts";
import { NG_MODULE_RUN_BLOCK, registerNgModule } from "@/runtime/ng-module-runtime.ts";

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
 * Carga un `@NgModule` (el de `loadChildren: () => import(...).then(m => m.XModule)`)
 * en una app **ya booteada**. AngularJS no tiene injectors hijos por módulo, así que
 * se replica `loadModules` de `angular.js` sobre el injector vivo: por cada módulo
 * del grafo que no esté cargado, se corren su `_invokeQueue` y `_configBlocks`
 * contra el *provider injector* (capturado en `ng.js.core`) y al final sus
 * `_runBlocks` con el instance injector.
 *
 * Los módulos de `RouterModule.forChild` **no** se corren (su `.config` registraría
 * los estados en la raíz): se marcan cargados y sus `Routes` se devuelven para que
 * `loadChildren` las traduzca rooteadas en la ruta padre.
 *
 * `providers`: los de los `@NgModule` **nuevos** del grafo no van al `$injector`
 * global, sino al entorno de la rama lazy (`NgModuleScope.environment`, el
 * `EnvironmentInjector` de Angular). Las `declarations` de esos módulos resuelven
 * su DI contra ese entorno (`scoped-injector-bridge`), y sus pipes también. Un
 * override de un servicio de la app aplica solo dentro de la rama.
 *
 * Las clases `@NgModule` del grafo (también las ya cargadas en la app) se instancian
 * en el scope de la rama — así un `@SkipSelf()` ve las instancias de la app.
 */
export class LazyNgModuleLoader {
  private readonly routes: Routes = [];

  constructor(private readonly $injector: InjectorWithModules) {}

  /** `stateName`: la ruta `loadChildren` — ancla del scope/entorno de esta rama lazy. */
  load(moduleType: Function, stateName: string): Routes {
    const registrar = ConfigProviderFactory.current;
    if (!registrar) throw new Error("loadChildren: no hay config-providers capturados (¿falta bootstrap?).");

    const module = registerNgModule(moduleType, routerRegistry.controllerAs);
    this.collectRoutes(module.name, new Set());

    const newModules: ModuleInternals[] = [];
    this.collectNewModules(module.name, newModules);

    const newNgModuleDefs = newModules.flatMap((mod) => {
      const type = ngModuleTypeOf(mod.name);
      const def = type ? getNgModuleDef(type) : undefined;
      return def ? [def] : [];
    });
    const providers: Provider[] = newNgModuleDefs.flatMap((def) => def.providers);
    const scope = ngModuleScopes.createForState(this.$injector, stateName, providers);
    const environment = scope.environment as ElementInjectorNode;
    ngModuleScopes.registerDeclarations(
      this.$injector,
      newNgModuleDefs.flatMap((def) => def.declarations.filter((d) => getComponentDef(d) || getDirectiveDef(d))),
      environment,
    );

    const runBlocks: angular.Injectable<Function>[] = [];
    for (const mod of newModules) {
      this.assertNoDeclarationCollisions(mod);
      const isNgModule = ngModuleTypeOf(mod.name) !== undefined;
      this.runQueue(mod._invokeQueue, registrar.$providerInjector, isNgModule ? environment : undefined);
      this.runQueue(mod._configBlocks, registrar.$providerInjector);
      runBlocks.push(...mod._runBlocks);
    }
    for (const block of runBlocks) {
      if (!(block as unknown as Record<symbol, unknown>)[NG_MODULE_RUN_BLOCK]) this.$injector.invoke(block);
    }

    this.instantiateModules(module.name, scope, new Set());
    return this.routes;
  }

  /** Post-orden (imports antes que el módulo), como el `R3Injector` de Angular. */
  private instantiateModules(name: string, scope: NgModuleScope, visited: Set<string>): void {
    if (visited.has(name)) return;
    visited.add(name);
    const moduleType = ngModuleTypeOf(name);
    if (!moduleType) return; // `angular.module` pelado (`ui.router`, `forChild`, …): no hay clase que instanciar
    for (const required of angular.module(name).requires) this.instantiateModules(required, scope, visited);
    const instance = scope.instantiate(moduleType, this.$injector);
    // Dentro de la rama, `inject(XModule)` da la instancia de la rama (no la de la app).
    scope.environment?.registerInstance(ngModuleInjectionName(name), instance);
  }

  /**
   * `Routes` de todos los `forChild` del grafo de imports — también los de módulos
   * que ya estaban cargados en la app (Angular: el injector lazy junta `ROUTES` de
   * todo su árbol de imports, sin importar lo que tenga el padre). Recorrido aparte
   * de `collectNewModules`, que sí corta en los módulos ya cargados.
   */
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

  /** Módulos del grafo que la app no tiene cargados, en post-orden; los marca cargados. */
  private collectNewModules(name: string, out: ModuleInternals[]): void {
    if (this.$injector.modules[name]) return;
    const module = angular.module(name) as ModuleInternals;
    this.$injector.modules[name] = module;
    if (routerRegistry.childRoutesOf(name)) return;

    for (const required of module.requires) this.collectNewModules(required, out);
    out.push(module);
  }

  /**
   * En Angular cada módulo tiene su propio alcance de `declarations`; en AngularJS
   * los nombres son globales. Un componente (elemento) o pipe lazy con un nombre
   * ya registrado se aplicaría encima del existente (doble template) o lo pisaría
   * para toda la app — se corta con un error claro en vez de fallar en silencio.
   * Las directivas de atributo quedan fuera: compartir nombre ahí es legítimo.
   */
  private assertNoDeclarationCollisions(module: ModuleInternals): void {
    for (const [providerName, method, args] of module._invokeQueue) {
      const name = args[0];
      if (typeof name !== "string") continue;
      const isComponent = providerName === "$compileProvider" && method === "component";
      const isPipe = providerName === "$filterProvider" && method === "register";
      const registered = isComponent ? `${name}Directive` : isPipe ? `${name}Filter` : undefined;
      if (registered && this.$injector.has(registered)) {
        const kind = isComponent ? "un componente" : "un pipe";
        throw new Error(
          `loadChildren: el @NgModule lazy "${module.name}" declara ${kind} "${name}" que ya existe en la app. ` +
            "En AngularJS las declarations son globales — renombralo o movelo a un módulo compartido.",
        );
      }
    }
  }

  /**
   * Corre una cola contra el provider injector. Con `environment` (módulo `@NgModule`
   * de la rama lazy): los `$provide` se saltean — sus `providers` viven en el entorno —
   * y los pipes resuelven sus deps contra el entorno en vez del `$injector`.
   */
  private runQueue(
    queue: InvokeQueueEntry[],
    providerInjector: angular.auto.IInjectorService,
    environment?: ElementInjectorNode,
  ): void {
    for (const [providerName, method, args] of queue) {
      if (environment && providerName === "$provide") continue;
      const finalArgs =
        environment && providerName === "$filterProvider" && method === "register"
          ? [args[0], filterFactoryIn(args[1] as unknown[], environment)]
          : args;
      const provider = providerInjector.get<Record<string, (...a: unknown[]) => unknown>>(providerName);
      provider[method].apply(provider, finalArgs);
    }
  }
}

/** `[...deps, factory]` de `createPipeFilter` → factory sin deps que las pide al entorno. */
function filterFactoryIn(injectable: unknown[], environment: ElementInjectorNode): Function {
  const deps = injectable.slice(0, -1) as string[];
  const factory = injectable.at(-1) as (...args: unknown[]) => unknown;
  const wrapped = () => factory(...deps.map((dep) => environment.get(dep)));
  wrapped.$inject = [] as string[];
  return wrapped;
}
