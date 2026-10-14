import { describe, expect, it, vi } from "vitest";
import { AnimationDriver, ɵAnimateCssDriver, ɵNoopAnimationDriver } from "@/animations/browser/index.ts";
import {
  AnimationBuilder,
  AnimationFactory,
  type AnimationPlayer,
  animate,
  BrowserAnimationBuilder,
  group,
  keyframes,
  NoopAnimationPlayer,
  sequence,
  style,
  ɵflattenAnimationToSegments,
  ɵparseAnimationTimings,
} from "@/animations/index.ts";

const frame = (styles: Record<string, string | number>) => new Map(Object.entries(styles));

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

/** `$animateCss` de mentira: registra las opciones de cada llamada y da runners controlables. */
function fakeAnimateCss() {
  const calls: Array<Record<string, unknown>> = [];
  const runners: Array<{ started: boolean; ended: boolean }> = [];
  const fn = ((_el: unknown, options: Record<string, unknown>) => {
    calls.push(options);
    const runner = {
      started: false,
      ended: false,
      start() {
        runner.started = true;
        const promise = Promise.resolve() as Promise<void> & { done(cb: (ok: boolean) => void): void };
        promise.done = (cb) => {
          void promise.then(() => cb(true));
        };
        return promise;
      },
      end() {
        runner.ended = true;
      },
    };
    runners.push(runner);
    return runner;
    // biome-ignore lint/suspicious/noExplicitAny: stub del contrato de ngAnimate
  }) as any;
  fn.calls = calls;
  fn.runners = runners;
  return fn;
}

describe("etapa 17 — ɵparseAnimationTimings", () => {
  it("acepta ms, s, delay y easing", () => {
    expect(ɵparseAnimationTimings("300ms")).toEqual({ duration: 300, delay: 0, easing: null });
    expect(ɵparseAnimationTimings("0.5s ease-in")).toEqual({ duration: 500, delay: 0, easing: "ease-in" });
    expect(ɵparseAnimationTimings("300ms 100ms ease-out")).toEqual({ duration: 300, delay: 100, easing: "ease-out" });
    expect(ɵparseAnimationTimings("250")).toEqual({ duration: 250, delay: 0, easing: null });
    expect(ɵparseAnimationTimings(400)).toEqual({ duration: 400, delay: 0, easing: null });
  });

  it("timing vacío/inválido → todo en cero", () => {
    expect(ɵparseAnimationTimings("")).toEqual({ duration: 0, delay: 0, easing: null });
    expect(ɵparseAnimationTimings("ease-in")).toEqual({ duration: 0, delay: 0, easing: null });
  });
});

describe("etapa 17 — ɵflattenAnimationToSegments", () => {
  it("`[style, animate(style)]` → un segmento con keyframes from (offset 0) → to (offset 1)", () => {
    const { segments, parallel } = ɵflattenAnimationToSegments([
      style({ opacity: 0 }),
      animate("300ms ease-out", style({ opacity: 1 })),
    ]);
    expect(parallel).toBe(false);
    expect(segments).toEqual([
      {
        keyframes: [frame({ opacity: 0, offset: 0 }), frame({ opacity: 1, offset: 1 })],
        duration: 300,
        delay: 0,
        easing: "ease-out",
      },
    ]);
  });

  it("`animate` suelto → un solo keyframe (el destino)", () => {
    const { segments } = ɵflattenAnimationToSegments(animate(200, style({ x: 1 })));
    expect(segments[0].keyframes).toEqual([frame({ x: 1, offset: 1 })]);
  });

  it("`sequence` = varios segmentos en orden; `group` = paralelo", () => {
    const seq = ɵflattenAnimationToSegments(
      sequence([animate("100ms", style({ a: 1 })), animate("100ms", style({ a: 2 }))]),
    );
    expect(seq.parallel).toBe(false);
    expect(seq.segments.map((s) => s.keyframes)).toEqual([[frame({ a: 1, offset: 1 })], [frame({ a: 2, offset: 1 })]]);

    const grp = ɵflattenAnimationToSegments(
      group([animate("100ms", style({ a: 1 })), animate("100ms", style({ a: 2 }))]),
    );
    expect(grp.parallel).toBe(true);
    expect(grp.segments).toHaveLength(2);
  });

  it("`[style(...)]` sin `animate` → segmento instantáneo", () => {
    const { segments } = ɵflattenAnimationToSegments([style({ color: "red" })]);
    expect(segments).toEqual([
      { keyframes: [frame({ color: "red", offset: 1 })], duration: 0, delay: 0, easing: null },
    ]);
  });

  it("`keyframes` → un frame por paso, con su `offset` o repartidos parejo", () => {
    const explicit = ɵflattenAnimationToSegments(
      animate(
        "1s",
        keyframes([style({ offset: 0, o: 0 }), style({ offset: 0.2, o: 0.9 }), style({ offset: 1, o: 1 })]),
      ),
    );
    expect(explicit.segments[0].keyframes).toEqual([
      frame({ o: 0, offset: 0 }),
      frame({ o: 0.9, offset: 0.2 }),
      frame({ o: 1, offset: 1 }),
    ]);

    const even = ɵflattenAnimationToSegments(
      animate("1s", keyframes([style({ o: 0 }), style({ o: 0.5 }), style({ o: 1 })])),
    );
    expect(even.segments[0].keyframes.map((k) => k.get("offset"))).toEqual([0, 0.5, 1]);
  });
});

describe("etapa 17 — BrowserAnimationBuilder sobre ɵAnimateCssDriver ($animateCss)", () => {
  const el = () => document.createElement("div");

  it("es un AnimationBuilder y build() da un AnimationFactory", () => {
    const builder = new BrowserAnimationBuilder(new ɵAnimateCssDriver(fakeAnimateCss()));
    expect(builder).toBeInstanceOf(AnimationBuilder);
    expect(builder.build([])).toBeInstanceOf(AnimationFactory);
  });

  it("play() llama a $animateCss con las opciones aplanadas y resuelve onDone", async () => {
    const css = fakeAnimateCss();
    const player = new BrowserAnimationBuilder(new ɵAnimateCssDriver(css))
      .build([style({ opacity: 0 }), animate("300ms ease-out", style({ opacity: 1 }))])
      .create(el());
    const done = vi.fn();
    player.onDone(done);

    player.play();
    expect(player.hasStarted()).toBe(true);
    await flushMicrotasks();

    expect(css.calls[0]).toMatchObject({ from: { opacity: 0 }, to: { opacity: 1 }, duration: 0.3, easing: "ease-out" });
    expect(done).toHaveBeenCalledTimes(1);
    expect(player.getPosition()).toBe(1);
  });

  it("sequence corre los segmentos en orden (nada síncrono); group los larga juntos", async () => {
    const seqCss = fakeAnimateCss();
    new BrowserAnimationBuilder(new ɵAnimateCssDriver(seqCss))
      .build(sequence([animate("50ms", style({ a: 1 })), animate("50ms", style({ a: 2 }))]))
      .create(el())
      .play();
    expect(seqCss.calls).toHaveLength(0); // encadenado por microtasks
    await flushMicrotasks();
    expect(seqCss.calls.map((c: Record<string, unknown>) => c.to)).toEqual([{ a: 1 }, { a: 2 }]);

    const grpCss = fakeAnimateCss();
    new BrowserAnimationBuilder(new ɵAnimateCssDriver(grpCss))
      .build(group([animate("50ms", style({ a: 1 })), animate("50ms", style({ a: 2 }))]))
      .create(el())
      .play();
    expect(grpCss.calls).toHaveLength(2); // en paralelo, síncrono
  });

  it("finish() aborta los runners en vuelo y marca done", () => {
    const css = fakeAnimateCss();
    const done = vi.fn();
    const player = new BrowserAnimationBuilder(new ɵAnimateCssDriver(css))
      .build(group([animate("300ms", style({ opacity: 1 }))]))
      .create(el());
    player.onDone(done);
    player.play();
    player.finish();
    expect(css.runners[0].ended).toBe(true);
    expect(done).toHaveBeenCalledTimes(1);
    expect(player.getPosition()).toBe(1);
  });

  it("create() con delay lo aplica al primer segmento", async () => {
    const css = fakeAnimateCss();
    new BrowserAnimationBuilder(new ɵAnimateCssDriver(css))
      .build(animate("300ms", style({ opacity: 1 })))
      .create(el(), { delay: 100 })
      .play();
    await flushMicrotasks();
    expect(css.calls[0]).toMatchObject({ delay: 0.1 });
  });

  it("`keyframes` → $animateCss solo recibe el primer y el último frame, sin `offset`", () => {
    const css = fakeAnimateCss();
    new BrowserAnimationBuilder(new ɵAnimateCssDriver(css))
      .build(group([animate("1s", keyframes([style({ o: 0 }), style({ o: 0.9 }), style({ o: 1 })]))]))
      .create(el())
      .play();
    expect(css.calls[0]).toEqual({ from: { o: 0 }, to: { o: 1 }, duration: 1, delay: undefined, easing: undefined });
  });

  it("metadata sin segmentos → NoopAnimationPlayer", async () => {
    const player = new BrowserAnimationBuilder(new ɵAnimateCssDriver(fakeAnimateCss())).build([]).create(el());
    expect(player).toBeInstanceOf(NoopAnimationPlayer);
    const done = vi.fn();
    player.onDone(done);
    player.play();
    await flushMicrotasks();
    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe("etapa 17 — AnimationDriver", () => {
  const el = () => document.createElement("div");

  type RecordedPlayer = AnimationPlayer & { done(): void; log: string[]; position: number };

  /** Driver de consumidor: registra cada `animate()` y da players controlables a mano. */
  class RecordingDriver extends ɵNoopAnimationDriver {
    readonly calls: Array<{ keyframes: unknown; duration: number; delay: number; easing?: string | null }> = [];
    readonly players: RecordedPlayer[] = [];

    override animate(
      _el: unknown,
      keyframes: Array<Map<string, string | number>>,
      duration: number,
      delay: number,
      easing?: string | null,
    ): AnimationPlayer {
      this.calls.push({ keyframes, duration, delay, easing });
      const doneFns: Array<() => void> = [];
      const player: RecordedPlayer = {
        log: [],
        position: 0,
        totalTime: duration + delay,
        init() {},
        hasStarted: () => true,
        onStart() {},
        onDone(fn) {
          doneFns.push(fn);
        },
        onDestroy() {},
        play() {
          player.log.push("play");
        },
        pause() {
          player.log.push("pause");
        },
        finish() {
          player.done();
        },
        reset() {},
        restart() {},
        destroy() {},
        setPosition(position) {
          player.position = position;
        },
        getPosition: () => player.position,
        done() {
          for (const fn of doneFns.splice(0)) fn();
        },
      };
      this.players.push(player);
      return player;
    }
  }

  it("ɵNoopAnimationDriver es un driver válido y AnimationDriver.NOOP lo expone", () => {
    const driver: AnimationDriver = AnimationDriver.NOOP;
    expect(driver).toBeInstanceOf(ɵNoopAnimationDriver);
    expect(driver.animate(el(), [], 200, 50)).toBeInstanceOf(NoopAnimationPlayer);
    expect(driver.animate(el(), [], 200, 50).totalTime).toBe(250);
    expect(driver.computeStyle(el(), "opacity", "1")).toBe("1");
  });

  it("helpers de DOM: query / containsElement / getParentElement / matchesElement", () => {
    const driver = new ɵNoopAnimationDriver();
    const parent = el();
    parent.innerHTML = '<span class="a"></span><span class="a"></span>';
    const child = parent.firstElementChild as Element;

    expect(driver.query(parent, ".a", true)).toHaveLength(2);
    expect(driver.query(parent, ".a", false)).toEqual([child]);
    expect(driver.query(parent, ".nope", false)).toEqual([]);
    expect(driver.containsElement(parent, child)).toBe(true);
    expect(driver.containsElement(child, parent)).toBe(false);
    expect(driver.getParentElement(child)).toBe(parent);
    expect(driver.matchesElement(child, ".a")).toBe(true);
  });

  it("el builder le pasa al driver keyframes + tiempos en ms", () => {
    const driver = new RecordingDriver();
    new BrowserAnimationBuilder(driver)
      .build([style({ opacity: 0 }), animate("300ms 100ms ease-out", style({ opacity: 1 }))])
      .create(el(), { delay: 50 })
      .play();

    return flushMicrotasks().then(() => {
      expect(driver.calls).toEqual([
        {
          keyframes: [frame({ opacity: 0, offset: 0 }), frame({ opacity: 1, offset: 1 })],
          duration: 300,
          delay: 150,
          easing: "ease-out",
        },
      ]);
    });
  });

  it("pause() / play() / setPosition() / getPosition() se delegan en los players del driver", async () => {
    const driver = new RecordingDriver();
    const player = new BrowserAnimationBuilder(driver)
      .build(sequence([animate("100ms", style({ a: 1 })), animate("300ms", style({ a: 2 }))]))
      .create(el());
    const done = vi.fn();
    player.onDone(done);
    expect(player.totalTime).toBe(400);

    player.play();
    await flushMicrotasks();
    expect(driver.players).toHaveLength(1); // el segundo segmento espera al primero

    player.pause();
    player.play();
    expect(driver.players[0].log).toEqual(["play", "pause", "play"]);

    driver.players[0].done();
    await flushMicrotasks();
    expect(driver.players).toHaveLength(2);

    player.setPosition(0.625); // 250ms de 400 → primer tramo completo, segundo a la mitad
    expect(driver.players[0].position).toBe(1);
    expect(driver.players[1].position).toBe(0.5);
    expect(player.getPosition()).toBe(0.625);

    expect(done).not.toHaveBeenCalled();
    driver.players[1].done();
    await flushMicrotasks();
    expect(done).toHaveBeenCalledTimes(1);
    expect(player.getPosition()).toBe(1);
  });
});

describe("etapa 17 — NoopAnimationPlayer", () => {
  it("onStart síncrono, onDone en microtask, posición 0→1", async () => {
    const player = new NoopAnimationPlayer(250);
    const order: string[] = [];
    player.onStart(() => order.push("start"));
    player.onDone(() => order.push("done"));

    player.play();
    expect(order).toEqual(["start"]);
    expect(player.getPosition()).toBe(0);

    await flushMicrotasks();
    expect(order).toEqual(["start", "done"]);
    expect(player.getPosition()).toBe(1);
    expect(player.totalTime).toBe(250);
  });
});
