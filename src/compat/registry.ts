import type angular from "angular";
import type { Provider } from "@/core/di/provider.ts";
import { ensureInject } from "@/core/di/reflect.ts";
import { assertNotServiceProvider } from "@/core/di/service.ts";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import {
  buildComponentAsDirective,
  buildComponentOptions,
  buildDirectiveDefinition,
} from "@/core/metadata/directive-definition.ts";
import { getDirectiveDef } from "@/core/metadata/directive.ts";
import { ngModule } from "@/core/metadata/ng-module.ts";
import { getPipeDef } from "@/core/metadata/pipe.ts";
import { parseSelector } from "@/core/metadata/selector-name.ts";
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

  async bootstrap(
    root: string | Element,
    options?: BootstrapOptions & {
      i18n?: import("@/runtime/i18n/index.ts").I18nConfig;
      /** `angular.IModule`s extra para `@NgModule({ imports })` — `RouterModule.forRoot(routes)`, `provideAnimations()`, `A11yModule`, … */
      imports?: angular.IModule[];
    },
  ): Promise<ApplicationRef> {
    installCoreModule();
    this.booted = true;

    const { i18n, imports: extraImports, ...bootstrapOptions } = options ?? {};
    const imports: angular.IModule[] = [commonModule(), ...(extraImports ?? [])];
    if (i18n) {
      // `import()` dinámico: `angular-translate` no entra al chunk base de compat.
      const { i18nModule } = await import("@/runtime/i18n/index.ts");
      imports.push(i18nModule(i18n));
    }

    class CompatAppModule {}
    ngModule(CompatAppModule).define({
      id: "ngjs.compat.app",
      imports,
      declarations: [...this.pendingDeclarations],
      providers: [...this.pendingProviders],
    });
    this.pendingDeclarations.clear();
    this.pendingProviders.length = 0;

    return bootstrapModuleRuntime(CompatAppModule, { hostElement: root, ...bootstrapOptions });
  }
}

export const compatRegistry = new CompatRegistry();

/** Registro post-bootstrap con los providers capturados en `.config()`. */
function registerDeclarationLive(clase: Function): void {
  const registrar = ConfigProviderFactory.current;
  if (!registrar) throw new Error("compat: no hay bootstrap ni config-providers capturados todavía");

  const cmp = getComponentDef(clase);
  if (cmp) {
    ensureInject(clase);
    const parsed = parseSelector(cmp.selector);
    if (parsed.restrict === "A") {
      registrar.$compile.directive(parsed.registrationName, () => buildComponentAsDirective(clase, cmp));
      return;
    }
    registrar.$compile.component(parsed.registrationName, buildComponentOptions(clase, cmp));
    return;
  }

  const dir = getDirectiveDef(clase);
  if (dir) {
    ensureInject(clase);
    const factory = (clase as { $factory?: () => angular.IDirective }).$factory;
    const parsed = parseSelector(dir.selector);
    registrar.$compile.directive(parsed.registrationName, factory ?? (() => buildDirectiveDefinition(clase, dir)));
    return;
  }

  const pipe = getPipeDef(clase);
  if (pipe) {
    (registrar.$filter.register as (name: string, factory: unknown) => unknown)(pipe.name, createPipeFilter(clase));
    return;
  }

  assertNotServiceProvider(clase);
  ensureInject(clase);
  registrar.$provide.service((clase as unknown as { $name: string }).$name, clase as unknown as Function);
}

function registerProviderLive(provider: Provider): void {
  const registrar = ConfigProviderFactory.current;
  if (!registrar) throw new Error("compat: no hay config-providers capturados todavía");
  if (typeof provider === "function") {
    assertNotServiceProvider(provider);
    ensureInject(provider);
    registrar.$provide.service((provider as unknown as { $name: string }).$name, provider as unknown as Function);
    return;
  }
  throw new Error("compat: providers con recetas (useValue/useClass/…) solo antes del bootstrap");
}
