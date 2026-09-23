import angular from "angular";
import { describe, expect, it } from "vitest";
import { getInjectableId } from "@/core/di/injectable-registry.ts";
import { exportAsRegistry } from "@/core/metadata/export-as-registry.ts";
import { SelectorRegistry } from "@/core/metadata/selector-registry.ts";
import { CoreModule, installCoreModule } from "@/runtime/core-module.ts";
import { registerNgModule } from "@/runtime/ng-module-runtime.ts";

/**
 * `ng-js-cli` no ejecuta decoradores — estampa `ɵcmp`/`ɵdir`/`ɵmod`/`$name`/
 * `$inject` directo como propiedades estáticas (ver `ng-js-cli/src/plugins/
 * decorator-writer.ts` y `module-writer.ts`). Estos tests arman esas mismas
 * clases a mano, SIN pasar por `@Component`/`@Directive`/`@NgModule`/
 * `@Injectable`, para confirmar que `registerNgModule`/`registerDeclaration`
 * hace todo el trabajo (registro AngularJS + identidad DI + `exportAs`) leyendo
 * solo el dato, sin depender de que un decorador haya corrido antes.
 */
describe("registro estilo CLI (sin decoradores)", () => {
  let counter = 0;
  function uniqueId(prefix: string): string {
    counter++;
    return `${prefix}${counter}`;
  }

  it("registra un componente cuyo ɵcmp fue estampado a mano y resuelve $inject por referencia de clase", () => {
    class GreeterService {
      greeting = "hola";
    }
    GreeterService.$name = uniqueId("GreeterService");

    class CliCard {
      greeter: GreeterService;
      constructor(greeter: GreeterService) {
        this.greeter = greeter;
      }
    }
    (CliCard as unknown as { $inject: unknown[] }).$inject = [GreeterService];
    (CliCard as unknown as { ɵcmp: unknown }).ɵcmp = {
      selector: "cli-card",
      template: "<span>{{$ctrl.greeter.greeting}}</span>",
      inputs: [],
      outputs: [],
    };

    class CliModule {}
    (CliModule as unknown as { ɵmod: unknown }).ɵmod = {
      id: uniqueId("CliModule"),
      declarations: [CliCard],
      imports: [],
      providers: [GreeterService],
      bootstrap: [],
    };
    (CliModule as unknown as { $name: string }).$name = (CliModule as unknown as { ɵmod: { id: string } }).ɵmod.id;

    const host = document.createElement("div");
    host.innerHTML = "<cli-card></cli-card>";
    document.body.appendChild(host);
    angular.bootstrap(host, [registerNgModule(CliModule).name], { strictDi: false });

    expect(host.querySelector("span")?.textContent).toBe("hola");
  });

  it("deriva la identidad DI (inject por selector) y exportAs sin que corra ningún decorador", () => {
    class CliWidget {}
    (CliWidget as unknown as { ɵcmp: unknown }).ɵcmp = {
      selector: "cli-widget",
      exportAs: "cliWidget",
      template: "<span>w</span>",
      inputs: [],
      outputs: [],
    };

    class CliModule {}
    (CliModule as unknown as { ɵmod: unknown }).ɵmod = {
      id: uniqueId("CliWidgetModule"),
      declarations: [CliWidget],
      imports: [],
      providers: [],
      bootstrap: [],
    };
    (CliModule as unknown as { $name: string }).$name = (CliModule as unknown as { ɵmod: { id: string } }).ɵmod.id;

    registerNgModule(CliModule);

    expect(getInjectableId(CliWidget)).toBe("cliWidget");
    expect(SelectorRegistry.getClass("cli-widget")).toBe(CliWidget);
    expect(exportAsRegistry.registrationNameFor("cliWidget")).toBe("cliWidget");
  });

  it("un @HostListener/@HostBinding estampado como host.listeners/host.bindings (sin decorador) igual dispara", () => {
    let clicked = 0;
    class CliButton {
      onClick(): void {
        clicked++;
      }
    }
    (CliButton as unknown as { ɵcmp: unknown }).ɵcmp = {
      selector: "cli-button",
      template: "<span></span>",
      inputs: [],
      outputs: [],
      host: { bindings: [], listeners: [{ methodName: "onClick", eventName: "click" }] },
    };

    class CliModule {}
    (CliModule as unknown as { ɵmod: unknown }).ɵmod = {
      id: uniqueId("CliButtonModule"),
      declarations: [CliButton],
      imports: [CoreModule],
      providers: [],
      bootstrap: [],
    };
    (CliModule as unknown as { $name: string }).$name = (CliModule as unknown as { ɵmod: { id: string } }).ɵmod.id;

    installCoreModule();
    const host = document.createElement("div");
    host.innerHTML = "<cli-button></cli-button>";
    document.body.appendChild(host);
    angular.bootstrap(host, [registerNgModule(CliModule).name], { strictDi: false });

    (host.querySelector("cli-button") as HTMLElement).click();
    expect(clicked).toBe(1);
  });
});
