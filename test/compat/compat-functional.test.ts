import "reflect-metadata";
import "zone.js";
import { describe, expect, it } from "vitest";
import { bootstrap, component, injectable } from "@/compat/index.ts";

describe("ngjs-core/compat — forma funcional", () => {
  it("component()/injectable() definidos antes del bootstrap se montan", async () => {
    class Api {
      static readonly $name = "compatFnApi";
      msg(): string {
        return "compat!";
      }
    }
    injectable(Api);

    class Root {
      static readonly $inject = ["compatFnApi"];
      msg: string;
      constructor(api: Api) {
        this.msg = api.msg();
      }
    }
    component(Root).define({ selector: "compat-fn-root", controllerAs: "$", template: "<i>{{ $.msg }}</i>" });

    const host = document.createElement("compat-fn-root");
    document.body.appendChild(host);
    const appRef = await bootstrap(host);

    expect(host.querySelector("i")?.textContent).toBe("compat!");
    appRef.destroy();
  });
});
