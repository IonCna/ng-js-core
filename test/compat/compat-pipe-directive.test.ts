import "reflect-metadata";
import "zone.js";
import { describe, expect, it } from "vitest";
import { bootstrap, component, directive, pipe } from "@/compat/index.ts";
import type { PipeTransform } from "@/pipes/pipe-transform.ts";

describe("ngjs-core/compat — pipe() y directive() funcionales", () => {
  it("auto-registran y corren en el template", async () => {
    class ShoutPipe implements PipeTransform {
      transform(value: unknown): string {
        return String(value).toUpperCase();
      }
    }
    pipe(ShoutPipe).define({ name: "shout" });

    class Ping {
      static readonly $inject = ["$element"];
      constructor($element: import("angular").IAugmentedJQuery) {
        ($element[0] as HTMLElement).setAttribute("data-ping", "1");
      }
    }
    directive(Ping).define({ selector: "[ping]", restrict: "A" });

    class Root {
      static readonly $inject: string[] = [];
      word = "hola";
    }
    component(Root).define({
      selector: "compat-pd-root",
      controllerAs: "$",
      template: "<b ping>{{ $.word | shout }}</b>",
    });

    const host = document.createElement("compat-pd-root");
    document.body.appendChild(host);
    const appRef = await bootstrap(host);

    const b = host.querySelector("b") as HTMLElement;
    expect(b.textContent).toBe("HOLA");
    expect(b.getAttribute("data-ping")).toBe("1");
    appRef.destroy();
  });
});
