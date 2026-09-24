import angular from "angular";
import { CompiledType } from "@/core/metadata/compiled-type.ts";

/** Registra en un `angular.module` una declaración compilada, con lo mismo que emitiría el compilador. */
export class TestingDeclarations {
  static register(module: angular.IModule, type: Function): void {
    const pipe = (type as { ɵpipe?: { name: string; pure: boolean } }).ɵpipe;
    const factory = (type as { ɵfac?: unknown[] }).ɵfac;
    if (pipe && factory) {
      TestingDeclarations.pipe(module, pipe, factory);
      return;
    }

    const def = CompiledType.def(type);
    if (!def || !factory)
      throw new Error(`TestBed: "${type.name}" no es un @Component/@Directive/@Pipe compilado.`);
    const definition = def.definition ?? {};

    if (CompiledType.isComponent(type)) {
      const tag = CompiledType.componentTag(type);
      if (!tag) throw new Error(`TestBed: "${type.name}" necesita un selector de elemento.`);
      module.component(CompiledType.camelCase(tag), {
        controller: factory,
        ...definition,
      } as angular.IComponentOptions);
      return;
    }

    for (const [tag, attribute] of def.selectors) {
      const name = CompiledType.camelCase(attribute || tag || "");
      const { bindings, ...rest } = definition as { bindings?: Record<string, string> };
      module.directive(name, () => ({
        controller: factory as never,
        restrict: attribute ? "A" : "E",
        bindToController: bindings ?? true,
        controllerAs: name,
        ...rest,
      }));
    }
  }

  private static pipe(module: angular.IModule, pipe: { name: string; pure: boolean }, factory: unknown[]): void {
    module.filter(pipe.name, [
      "$injector",
      ($injector: angular.auto.IInjectorService) => {
        const instance = $injector.invoke<{ transform(...args: unknown[]): unknown }>(factory as never);
        const filter = (...args: unknown[]) => instance.transform(...args);
        if (!pipe.pure) (filter as { $stateful?: boolean }).$stateful = true;
        return filter;
      },
    ]);
  }

  /** Nombre del `angular.module` de un import: `@NgModule` compilado (`ɵmod.id`), `angular.IModule` o su nombre. */
  static moduleName(imported: Function | angular.IModule | string): string {
    if (typeof imported === "string") return imported;
    if (typeof imported === "function") {
      const id = (imported as { ɵmod?: { id: string } }).ɵmod?.id;
      if (!id) throw new Error(`TestBed: "${imported.name}" no es un @NgModule compilado.`);
      return id;
    }
    return imported.name;
  }
}
