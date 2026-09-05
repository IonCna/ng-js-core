import type angular from "angular";
import type { Provider } from "@/core/di/provider.ts";
import { ensureInject } from "@/core/di/reflect.ts";
import { bindingsFromDefs } from "@/core/metadata/component-bindings.ts";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import { getDirectiveDef } from "@/core/metadata/directive.ts";
import { ngModule } from "@/core/metadata/ng-module.ts";
import { getPipeDef } from "@/core/metadata/pipe.ts";
import type { ApplicationRef } from "@/core/platform/application-ref.ts";
import type { BootstrapOptions } from "@/core/platform/bootstrap.ts";
import { ConfigProviderFactory } from "@/core/platform/config-providers.ts";
import { createPipeFilter } from "@/pipes/pipe-transform.ts";
import { commonModule } from "@/runtime/common/index.ts";
import { bootstrapModuleRuntime, installCoreModule } from "@/runtime/index.ts";

/**
 * El motor de auto-registro de `ngjs-core/compat`. Cada `component()/directive()/
 * pipe()/injectable()/ngModule().define()` empuja la clase acá. Antes del bootstrap
 * se acumulan; después, se registran en vivo con los config-providers capturados
 * (mismo mecanismo que los componentes lazy). No se puede apagar — es la razón de
 * ser de `/compat` (usuarios JS sin build ni `AppModule` explícito).
 */
class CompatRegistry {
  private readonly pendingDeclarations = new Set<Function>();
  private readonly pendingProviders: Provider[] = [];
  private booted = false;

  declare(clase: Function): void {
    if (this.booted || ConfigProviderFactory.current) {
      registerDeclarationLive(clase);
      return;
    }
    this.pendingDeclarations.add(clase);
  }

  provide(provider: Provider): void {
    if (this.booted || ConfigProviderFactory.current) {
      registerProviderLive(provider);
      return;
    }
    this.pendingProviders.push(provider);
  }

  bootstrap(root: string | Element, options?: BootstrapOptions): Promise<ApplicationRef> {
    installCoreModule();
    this.booted = true;

    class CompatAppModule {}
    ngModule(CompatAppModule).define({
      id: "ngjs.compat.app",
      imports: [commonModule()],
      declarations: [...this.pendingDeclarations],
      providers: [...this.pendingProviders],
    });
    this.pendingDeclarations.clear();
    this.pendingProviders.length = 0;

    return bootstrapModuleRuntime(CompatAppModule, { hostElement: root, ...options });
  }
}

export const compatRegistry = new CompatRegistry();

function toCamelCase(value: string): string {
  return value.replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
}

function stripAttr(selector: string): string {
  return selector.startsWith("[") && selector.endsWith("]") ? selector.slice(1, -1) : selector;
}

/** Registro post-bootstrap con los providers capturados en `.config()`. */
function registerDeclarationLive(clase: Function): void {
  const registrar = ConfigProviderFactory.current;
  if (!registrar) throw new Error("compat: no hay bootstrap ni config-providers capturados todavía");

  const cmp = getComponentDef(clase);
  if (cmp) {
    ensureInject(clase);
    registrar.$compile.component(toCamelCase(cmp.selector), {
      controller: clase as unknown as angular.Injectable<angular.IControllerConstructor>,
      template: cmp.template,
      templateUrl: cmp.templateUrl,
      controllerAs: cmp.controllerAs,
      require: cmp.require,
      bindings: cmp.bindings ?? bindingsFromDefs(cmp.inputs, cmp.outputs),
      transclude: cmp.transclude ?? (cmp.template?.includes("<ng-content") ? true : undefined),
    });
    return;
  }

  const dir = getDirectiveDef(clase);
  if (dir) {
    ensureInject(clase);
    const factory = (clase as { $factory?: () => angular.IDirective }).$factory;
    registrar.$compile.directive(
      toCamelCase(stripAttr(dir.selector)),
      factory ??
        (() => ({
          controller: clase as unknown as angular.Injectable<angular.IControllerConstructor>,
          restrict: dir.restrict ?? (dir.selector.startsWith("[") ? "A" : "E"),
          scope: dir.scope,
          bindToController: dir.bindToController ?? true,
          require: dir.require,
          transclude: dir.transclude,
          template: dir.template,
          templateUrl: dir.templateUrl,
          controllerAs: dir.controllerAs,
        })),
    );
    return;
  }

  const pipe = getPipeDef(clase);
  if (pipe) {
    (registrar.$filter.register as (name: string, factory: unknown) => unknown)(pipe.name, createPipeFilter(clase));
    return;
  }

  ensureInject(clase);
  registrar.$provide.service((clase as unknown as { $name: string }).$name, clase as unknown as Function);
}

function registerProviderLive(provider: Provider): void {
  const registrar = ConfigProviderFactory.current;
  if (!registrar) throw new Error("compat: no hay config-providers capturados todavía");
  if (typeof provider === "function") {
    ensureInject(provider);
    registrar.$provide.service((provider as unknown as { $name: string }).$name, provider as unknown as Function);
    return;
  }
  throw new Error("compat: providers con recetas (useValue/useClass/…) solo antes del bootstrap");
}
