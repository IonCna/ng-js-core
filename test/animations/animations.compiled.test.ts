import { afterEach, describe, expect, it } from "vitest";
import { CompiledApp } from "../compiled-app.ts";

/** Porta de `old/test/animations/runtime-animations.test.ts`: los módulos, ahora `@NgModule` compilados. */
describe("etapa 17 — BrowserAnimationsModule / NoopAnimationsModule (código compilado)", () => {
  let app: CompiledApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  async function boot(module: "BrowserAnimationsModule" | "NoopAnimationsModule"): Promise<CompiledApp> {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `
import { Component, NgModule } from "ngjs-core";
import { ${module}, animate, style } from "ngjs-core/animations";

@Component({ selector: "app-root", template: "" })
export class AppComponent {}

@NgModule({ imports: [${module}], declarations: [AppComponent], bootstrap: [AppComponent] })
export class AppModule {}

(globalThis as any).dsl = { animate, style };
`,
      },
      "<app-root></app-root>",
    );
    return app;
  }

  type Player = { play(): void; finish(): void; hasStarted(): boolean; getPosition(): number; onDone(fn: () => void): void };
  type Builder = { build(steps: unknown): { create(el: Element): Player } };
  const steps = (app: CompiledApp) => {
    const { animate, style } = app.global<{ animate: (t: string, s: unknown) => unknown; style: (s: object) => unknown }>("dsl");
    return [style({ opacity: 0 }), animate("120ms", style({ opacity: 1 }))];
  };

  it("BrowserAnimationsModule trae ngAnimate y provee el AnimationBuilder real, que anima vía $animateCss", async () => {
    await boot("BrowserAnimationsModule");
    expect(typeof app!.get("$animateCss")).toBe("function");

    const builder = app!.inject<Builder>("AnimationBuilder");
    expect(builder.constructor.name).toBe("BrowserAnimationBuilder");

    const el = app!.document.createElement("div");
    app!.document.body.appendChild(el);
    const player = builder.build(steps(app!)).create(el);
    const done = new Promise<void>((resolve) => player.onDone(resolve));
    player.play();
    expect(player.hasStarted()).toBe(true);

    app!.digest();
    player.finish(); // en jsdom no hay transitionend real — cerramos a mano
    await done;
    expect(player.getPosition()).toBe(1);
  });

  it("NoopAnimationsModule apaga $animate y provee el builder no-op; su player igual resuelve onDone", async () => {
    await boot("NoopAnimationsModule");
    expect(app!.get<{ enabled(): boolean }>("$animate").enabled()).toBe(false);
    const player = app!.inject<Builder>("AnimationBuilder").build(steps(app!)).create(app!.document.createElement("div"));
    expect(player.constructor.name).toBe("NoopAnimationPlayer");

    let finished = false;
    player.onDone(() => {
      finished = true;
    });
    player.play();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(finished).toBe(true);
  });
});
