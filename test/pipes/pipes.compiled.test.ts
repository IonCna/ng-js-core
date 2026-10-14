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

  it("number y currency de CommonModule reemplazan a los filtros de AngularJS: firma de Angular", async () => {
    await boot(
      "<p>{{ 95.46 | number: '1.0-0' }}</p><b>{{ 1234.5 | currency }}</b><i>{{ 10 | currency: 'USD': 'code' }}</i><s>{{ [1, 2, 3] | slice: 1 | json }}</s><u>{{ 2 | i18nPlural: { one: '# pedido', other: '# pedidos' } }}</u>",
    );
    const root = app!.document.querySelector("app-root")!;
    expect(root.querySelector("p")?.textContent).toBe("95");
    expect(root.querySelector("b")?.textContent).toBe("$1,234.50");
    expect(root.querySelector("i")?.textContent).toBe("USD 10.00");
    expect(root.querySelector("s")?.textContent?.replace(/\s/g, "")).toBe("[2,3]");
    expect(root.querySelector("u")?.textContent).toBe("2 pedidos");
  });

  it("async:this (lo que escribe ng-js-template-compiler por `| async`) pinta cada emisión y es $stateful", async () => {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `
import { Component, NgModule } from "ngjs-core";
import { CommonModule } from "ngjs-core/common";
import { BehaviorSubject, of } from "rxjs";

@Component({
  selector: "app-root",
  template: '<p>{{ $ctrl.name$ | async:this }}</p><li ng-repeat="n in $ctrl.items$ | async:this track by n">{{ n }}</li>',
})
export class AppComponent {
  readonly name$ = new BehaviorSubject("Ana");
  readonly items$ = of([1, 2]);
}

@NgModule({ imports: [CommonModule], declarations: [AppComponent], bootstrap: [AppComponent] })
export class AppModule {}
`,
      },
      "<app-root></app-root>",
    );
    app.digest();
    const root = app.document.querySelector("app-root")!;
    expect(root.querySelector("p")?.textContent).toBe("Ana");
    expect(root.querySelectorAll("li").length).toBe(2);
    expect(app.get<(name: string) => { $stateful?: boolean }>("$filter")("async").$stateful).toBe(true);
  });
});
