import { afterEach, describe, expect, it } from "vitest";
import { CompiledApp } from "../compiled-app.ts";

/**
 * Pipes registrados como `.filter()` real — lo emite el compilador para cada `@Pipe` declarado. Porta de
 * `old/test/pipes/pipe-transform.test.ts` (`createPipeFilter`) y de los bloques "registrado como .filter() real" de
 * `key-value`/`percent`/`title-case` (la lógica de cada pipe sigue en su test unitario).
 */
describe("etapa 11 — @Pipe como .filter() de AngularJS (código compilado)", () => {
  let app: CompiledApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  async function boot(template: string, extra = "", declarations = ""): Promise<CompiledApp> {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `
import { Component, Injectable, NgModule, Pipe, type PipeTransform } from "ngjs-core";
import { CommonModule } from "ngjs-core/common";
${extra}
@Component({ selector: "app-root", template: ${JSON.stringify(template)} })
export class AppComponent {}

@NgModule({ imports: [CommonModule], declarations: [AppComponent${declarations}], bootstrap: [AppComponent] })
export class AppModule {}
`,
      },
      "<app-root></app-root>",
    );
    app.digest();
    return app;
  }

  it("una clase @Pipe declarada se registra como .filter() y transforma el valor en el template", async () => {
    await boot(
      "{{ 'hola' | shout }}",
      `@Pipe({ name: "shout" })
export class ShoutPipe implements PipeTransform { transform(value: string): string { return value + "!!!"; } }`,
      ", ShoutPipe",
    );
    expect(app!.document.querySelector("app-root")?.textContent?.trim()).toBe("hola!!!");
  });

  it("un @Pipe con dependencias de constructor las resuelve por DI", async () => {
    await boot(
      "{{ 'hola' | prefixed }}",
      `@Injectable({ providedIn: "root" })
export class Prefixer { apply(value: string): string { return "[" + value + "]"; } }

@Pipe({ name: "prefixed" })
export class PrefixedPipe implements PipeTransform {
  constructor(private readonly prefixer: Prefixer) {}
  transform(value: string): string { return this.prefixer.apply(value); }
}`,
      ", PrefixedPipe",
    );
    expect(app!.document.querySelector("app-root")?.textContent?.trim()).toBe("[hola]");
  });

  it("pure:false marca $stateful en la función que $filter(name) devuelve; pure:true (default) no", async () => {
    await boot(
      "",
      `@Pipe({ name: "impureCount", pure: false })
export class ImpureCountPipe { transform(value: unknown[]): number { return value.length; } }
@Pipe({ name: "pureCount" })
export class PureCountPipe { transform(value: unknown[]): number { return value.length; } }`,
      ", ImpureCountPipe, PureCountPipe",
    );
    const $filter = app!.get<(name: string) => { $stateful?: boolean }>("$filter");
    expect($filter("impureCount").$stateful).toBe(true);
    expect($filter("pureCount").$stateful).toBeUndefined();
  });

  it("los pipes de CommonModule: keyvalue (ordenado y $stateful), percent y titlecase", async () => {
    await boot(
      "<div ng-repeat=\"item in ({b: 2, a: 1} | keyvalue)\">{{item.key}}={{item.value}};</div><p>{{ 0.42 | percent }}</p><h1>{{ 'hola mundo' | titlecase }}</h1>",
    );
    const root = app!.document.querySelector("app-root")!;
    expect(Array.from(root.querySelectorAll("div"), (div) => div.textContent?.trim()).join("")).toBe("a=1;b=2;");
    expect(root.querySelector("p")?.textContent).toBe("42%");
    expect(root.querySelector("h1")?.textContent).toBe("Hola Mundo");
    expect(app!.get<(name: string) => { $stateful?: boolean }>("$filter")("keyvalue").$stateful).toBe(true);
  });

  it("date/number/currency/json/uppercase de Angular reemplazan al filtro de AngularJS del mismo nombre; slice/i18nPlural/i18nSelect", async () => {
    await boot(
      [
        "<p id=n>{{ 1234.5 | number:'1.2-2' }}</p>",
        "<p id=c>{{ 5 | currency:'EUR':'code' }}</p>",
        "<p id=d>{{ 0 | date:'yyyy-MM-dd HH:mm':'UTC' }}</p>",
        "<p id=u>{{ 'hola' | uppercase }}</p>",
        "<p id=s>{{ 'abcdef' | slice:1:3 }}</p>",
        "<p id=p>{{ 3 | i18nPlural:{ one: 'uno', other: '# varios' } }}</p>",
        "<p id=g>{{ 'female' | i18nSelect:{ female: 'ella', other: 'elle' } }}</p>",
      ].join(""),
    );
    const text = (id: string) => app!.document.getElementById(id)?.textContent;
    expect(text("n")).toBe("1,234.50");
    expect(text("c")).toBe("EUR5.00");
    expect(text("d")).toBe("1970-01-01 00:00");
    expect(text("u")).toBe("HOLA");
    expect(text("s")).toBe("bc");
    expect(text("p")).toBe("3 varios");
    expect(text("g")).toBe("ella");

    // Desde código, como ngb-js: `$filter("date")(fecha, formato, zona)`.
    const $filter = app!.get<(name: string) => (...args: unknown[]) => unknown>("$filter");
    expect($filter("date")(new Date(Date.UTC(2020, 0, 1, 13)), "a", "UTC")).toBe("PM");
    expect($filter("json").$stateful).toBe(true);
  });
});
