import { describe, expect, it, vi } from "vitest";
import {
  AnimationBuilder,
  AnimationFactory,
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
    expect(ɵparseAnimationTimings("300ms")).toEqual({ duration: 0.3, delay: 0, easing: null });
    expect(ɵparseAnimationTimings("0.5s ease-in")).toEqual({ duration: 0.5, delay: 0, easing: "ease-in" });
    expect(ɵparseAnimationTimings("300ms 100ms ease-out")).toEqual({ duration: 0.3, delay: 0.1, easing: "ease-out" });
    expect(ɵparseAnimationTimings("250")).toEqual({ duration: 0.25, delay: 0, easing: null });
    expect(ɵparseAnimationTimings(400)).toEqual({ duration: 0.4, delay: 0, easing: null });
  });

  it("timing vacío/inválido → todo en cero", () => {
    expect(ɵparseAnimationTimings("")).toEqual({ duration: 0, delay: 0, easing: null });
    expect(ɵparseAnimationTimings("ease-in")).toEqual({ duration: 0, delay: 0, easing: null });
  });
});

describe("etapa 17 — ɵflattenAnimationToSegments", () => {
  it("`[style, animate(style)]` → un segmento from→to", () => {
    const { segments, parallel } = ɵflattenAnimationToSegments([
      style({ opacity: 0 }),
      animate("300ms ease-out", style({ opacity: 1 })),
    ]);
    expect(parallel).toBe(false);
    expect(segments).toEqual([
      { from: { opacity: 0 }, to: { opacity: 1 }, duration: 0.3, delay: 0, easing: "ease-out" },
    ]);
  });

  it("`animate` suelto → `from` null", () => {
    const { segments } = ɵflattenAnimationToSegments(animate(200, style({ x: 1 })));
    expect(segments[0].from).toBeNull();
    expect(segments[0].to).toEqual({ x: 1 });
  });

  it("`sequence` = varios segmentos en orden; `group` = paralelo", () => {
    const seq = ɵflattenAnimationToSegments(
      sequence([animate("100ms", style({ a: 1 })), animate("100ms", style({ a: 2 }))]),
    );
    expect(seq.parallel).toBe(false);
    expect(seq.segments.map((s) => s.to)).toEqual([{ a: 1 }, { a: 2 }]);

    const grp = ɵflattenAnimationToSegments(
      group([animate("100ms", style({ a: 1 })), animate("100ms", style({ a: 2 }))]),
    );
    expect(grp.parallel).toBe(true);
    expect(grp.segments).toHaveLength(2);
  });

  it("`[style(...)]` sin `animate` → segmento instantáneo", () => {
    const { segments } = ɵflattenAnimationToSegments([style({ color: "red" })]);
    expect(segments).toEqual([{ from: null, to: { color: "red" }, duration: 0, delay: 0, easing: null }]);
  });

  it("`keyframes` → último frame como destino (brecha documentada)", () => {
    const { segments } = ɵflattenAnimationToSegments(
      animate("1s", keyframes([style({ offset: 0, o: 0 }), style({ offset: 1, o: 1 })])),
    );
    expect(segments[0].to).toEqual({ offset: 1, o: 1 });
  });
});

describe("etapa 17 — BrowserAnimationBuilder sobre $animateCss", () => {
  const el = () => document.createElement("div");

  it("es un AnimationBuilder y build() da un AnimationFactory", () => {
    const builder = new BrowserAnimationBuilder(fakeAnimateCss());
    expect(builder).toBeInstanceOf(AnimationBuilder);
    expect(builder.build([])).toBeInstanceOf(AnimationFactory);
  });

  it("play() llama a $animateCss con las opciones aplanadas y resuelve onDone", async () => {
    const css = fakeAnimateCss();
    const player = new BrowserAnimationBuilder(css)
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
    new BrowserAnimationBuilder(seqCss)
      .build(sequence([animate("50ms", style({ a: 1 })), animate("50ms", style({ a: 2 }))]))
      .create(el())
      .play();
    expect(seqCss.calls).toHaveLength(0); // encadenado por microtasks
    await flushMicrotasks();
    expect(seqCss.calls.map((c: Record<string, unknown>) => c.to)).toEqual([{ a: 1 }, { a: 2 }]);

    const grpCss = fakeAnimateCss();
    new BrowserAnimationBuilder(grpCss)
      .build(group([animate("50ms", style({ a: 1 })), animate("50ms", style({ a: 2 }))]))
      .create(el())
      .play();
    expect(grpCss.calls).toHaveLength(2); // en paralelo, síncrono
  });

  it("finish() aborta los runners en vuelo y marca done", () => {
    const css = fakeAnimateCss();
    const done = vi.fn();
    const player = new BrowserAnimationBuilder(css)
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
    new BrowserAnimationBuilder(css)
      .build(animate("300ms", style({ opacity: 1 })))
      .create(el(), { delay: 100 })
      .play();
    await flushMicrotasks();
    expect(css.calls[0]).toMatchObject({ delay: 0.1 });
  });

  it("metadata sin segmentos → NoopAnimationPlayer", async () => {
    const player = new BrowserAnimationBuilder(fakeAnimateCss()).build([]).create(el());
    expect(player).toBeInstanceOf(NoopAnimationPlayer);
    const done = vi.fn();
    player.onDone(done);
    player.play();
    await flushMicrotasks();
    expect(done).toHaveBeenCalledTimes(1);
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
