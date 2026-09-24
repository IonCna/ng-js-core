import type angular from "angular";
import { CompiledType } from "@/core/metadata/compiled-type.ts";
import { ConfigProviderFactory } from "@/core/platform/config-providers.ts";

/**
 * Registra al vuelo, en una app ya arrancada, un `@Component` compilado que no está en ningún `@NgModule` cargado
 * (el `loadComponent` del router): con su `ɵfac` y su `ɵcmp.definition`, lo mismo que el compilador emite en
 * `.component()`. Usa el `$compileProvider` que capturó `NativeModule` en la fase de config.
 */
export class ComponentRegistrar {
  /** Constante de la app con el `controllerAs` del `@NgModule` raíz (`ɵmod.controllerAs`), si declara uno. */
  static readonly ROOT_CONTROLLER_AS = "ɵngjsRootControllerAs";

  /** El `controllerAs` del `@NgModule` raíz de la app de `$injector`, o `undefined`. */
  static rootControllerAs($injector: angular.auto.IInjectorService): string | undefined {
    const name = ComponentRegistrar.ROOT_CONTROLLER_AS;
    return $injector.has(name) ? $injector.get<string>(name) : undefined;
  }

  /**
   * Nombre de registro (camelCase del tag); si ya está registrado, no hace nada. `fallbackControllerAs` hace lo que
   * el compilador hace con los declarados en un `@NgModule` con `controllerAs`: aplica a un componente con template
   * que no declara uno propio.
   */
  static ensure(type: Function, $injector: angular.auto.IInjectorService, fallbackControllerAs?: string): string {
    const tag = CompiledType.componentTag(type);
    if (!tag) throw new Error(`"${type.name}" no es un @Component compilado con selector de elemento.`);
    const name = CompiledType.camelCase(tag);
    if ($injector.has(`${name}Directive`)) return name;

    const registrar = ConfigProviderFactory.current;
    if (!registrar) {
      throw new Error(
        `No se puede registrar "${type.name}": no hay providers de config capturados (¿falta el bootstrap?).`,
      );
    }
    const factory = (type as { ɵfac?: unknown }).ɵfac;
    const definition = (CompiledType.def(type)?.definition ?? {}) as angular.IComponentOptions;
    const hasTemplate = definition.template !== undefined || definition.templateUrl !== undefined;
    registrar.$compile.component(name, {
      controller: factory,
      ...definition,
      ...(fallbackControllerAs &&
        hasTemplate &&
        definition.controllerAs === undefined && { controllerAs: fallbackControllerAs }),
    } as angular.IComponentOptions);
    return name;
  }
}
