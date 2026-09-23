import angular from "angular";
import { describe, expect, it } from "vitest";
import { type AnimationBuilder, BrowserAnimationBuilder, NoopAnimationPlayer } from "@/animations/animation-builder.ts";
import { animate, style } from "@/animations/dsl.ts";
import {
  BrowserAnimationsModule,
  browserAnimationsModule,
  NoopAnimationsModule,
  noopAnimationsModule,
  provideAnimations,
  provideNoopAnimations,
} from "@/runtime/animations/index.ts";

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

function boot(moduleName: string): angular.auto.IInjectorService {
  const host = document.createElement("div");
  document.body.appendChild(host);
  return angular.bootstrap(host, [moduleName], { strictDi: false });
}

describe("etapa 17 — ngjs-core/runtime/animations", () => {
  it("los factories son memoizados y `provide*` devuelve el mismo módulo", () => {
    expect(browserAnimationsModule()).toBe(BrowserAnimationsModule);
    expect(provideAnimations()).toBe(BrowserAnimationsModule);
    expect(noopAnimationsModule()).toBe(NoopAnimationsModule);
    expect(provideNoopAnimations()).toBe(NoopAnimationsModule);
  });

  it("BrowserAnimationsModule depende de ngAnimate y bindea AnimationBuilder → BrowserAnimationBuilder", () => {
    expect(BrowserAnimationsModule.requires).toContain("ngAnimate");

    const injector = boot(BrowserAnimationsModule.name);
    const builder = injector.get<AnimationBuilder>("AnimationBuilder");
    expect(builder).toBeInstanceOf(BrowserAnimationBuilder);
    // El builder real inyecta `$animateCss` de ngAnimate sin explotar.
    expect(typeof injector.get("$animateCss")).toBe("function");
  });

  it("el AnimationBuilder inyectado anima un elemento vía $animateCss", async () => {
    const injector = boot(BrowserAnimationsModule.name);
    const builder = injector.get<AnimationBuilder>("AnimationBuilder");

    const el = document.createElement("div");
    document.body.appendChild(el);
    const player = builder.build([style({ opacity: 0 }), animate("120ms", style({ opacity: 1 }))]).create(el);

    const done = new Promise<void>((resolve) => player.onDone(resolve));
    player.play();
    expect(player.hasStarted()).toBe(true);

    injector.get<angular.IRootScopeService>("$rootScope").$digest();
    player.finish(); // en jsdom no hay transitionend real — cerramos a mano
    await done;
    expect(player.getPosition()).toBe(1);
  });

  it("NoopAnimationsModule apaga $animate y bindea el builder no-op", () => {
    const injector = boot(NoopAnimationsModule.name);

    expect(injector.get<angular.animate.IAnimateService>("$animate").enabled()).toBe(false);

    const builder = injector.get<AnimationBuilder>("AnimationBuilder");
    const player = builder
      .build([style({ opacity: 0 }), animate("120ms", style({ opacity: 1 }))])
      .create(document.createElement("div"));
    expect(player).toBeInstanceOf(NoopAnimationPlayer);
  });

  it("el player no-op igual resuelve onDone", async () => {
    const injector = boot(NoopAnimationsModule.name);
    const builder = injector.get<AnimationBuilder>("AnimationBuilder");
    const player = builder.build([]).create(document.createElement("div"));

    let finished = false;
    player.onDone(() => {
      finished = true;
    });
    player.play();
    await flushMicrotasks();
    expect(finished).toBe(true);
  });
});
