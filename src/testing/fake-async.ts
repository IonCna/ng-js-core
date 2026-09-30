/**
 * `fakeAsync`/`tick`/`flush`/`flushMicrotasks`/`discardPeriodicTasks`/`waitForAsync` de `@angular/core/testing`, sin
 * Zone.js: los parches globales de `ng-js-compiler` (la "zona" de ngjs) le entregan los timers,
 * `requestAnimationFrame` y `queueMicrotask` a `globalThis.ɵngjsFakeAsync` mientras hay uno activo — también los de un
 * `$browser` de AngularJS creado antes, que guardó el `setTimeout` parcheado. Las promesas son las de `FakePromise`
 * (`globalThis.Promise` mientras dura el `fakeAsync`; el `async`/`await` compilado se baja a `.then()` sobre ese
 * global) y `Date` avanza con el reloj falso, como en Angular.
 *
 * Cada callback corre en la zona donde se programó (`globalThis.ɵngjsZone`): adentro, con digest al terminar — lo
 * mismo que pasa en la app.
 */

type Run = (...args: unknown[]) => void;
type TimerKind = "timeout" | "interval" | "animationFrame";

interface ZoneLike {
  inside(): boolean;
  runIn<T>(inside: boolean, fn: (...args: unknown[]) => T, self: unknown, args: ArrayLike<unknown>): T;
}

interface SchedulerLike {
  schedule(kind: TimerKind, run: Run, delay?: number): unknown;
  cancel(id: unknown): boolean;
  queueMicrotask(run: () => void): void;
}

interface FakeAsyncGlobals {
  ɵngjsZone?: ZoneLike;
  ɵngjsFakeAsync?: SchedulerLike;
  Promise: PromiseConstructor;
  Date: DateConstructor;
}

const globals = globalThis as unknown as FakeAsyncGlobals;
const NativePromise = globalThis.Promise;
const NativeDate = globalThis.Date;
/** `requestAnimationFrame` en el reloj falso: un frame cada 16 ms, como el de Angular. */
const FRAME_MS = 16;

interface Timer {
  id: number;
  kind: TimerKind;
  run: Run;
  time: number;
  period?: number;
  seq: number;
}

/** El reloj falso de un `fakeAsync` activo: timers ordenados por tiempo, microtasks en cola y los rechazos sin manejar. */
class FakeAsyncZone implements SchedulerLike {
  static active: FakeAsyncZone | undefined;

  private timers: Timer[] = [];
  private microtasks: (() => void)[] = [];
  private readonly unhandled = new Set<FakePromise<unknown>>();
  private nextId = 2 ** 30; // lejos de los ids del navegador/jsdom
  private seq = 0;
  /** Milisegundos falsos transcurridos desde que empezó. */
  elapsed = 0;
  private readonly realStart = NativeDate.now();
  private previous: { scheduler?: SchedulerLike; Promise: PromiseConstructor; Date: DateConstructor } | undefined;
  /** Sin los parches de `ng-js-compiler` (nadie le entrega los timers al hook): los globales que se reemplazaron. */
  private replacedGlobals: [string, unknown][] = [];

  static start(): FakeAsyncZone {
    if (FakeAsyncZone.active) throw new Error("fakeAsync() calls can not be nested");
    const zone = new FakeAsyncZone();
    zone.previous = { scheduler: globals.ɵngjsFakeAsync, Promise: globals.Promise, Date: globals.Date };
    globals.ɵngjsFakeAsync = zone;
    globals.Promise = FakePromise as unknown as PromiseConstructor;
    globals.Date = FakeDate.of(zone);
    if (!globals.ɵngjsZone) zone.replaceTimerGlobals();
    FakeAsyncZone.active = zone;
    return zone;
  }

  static current(): FakeAsyncZone {
    const zone = FakeAsyncZone.active;
    if (!zone) throw new Error("The code should be running in the fakeAsync zone to call this function");
    return zone;
  }

  stop(): void {
    if (FakeAsyncZone.active !== this) return;
    FakeAsyncZone.active = undefined;
    globals.ɵngjsFakeAsync = this.previous?.scheduler;
    globals.Promise = this.previous?.Promise ?? NativePromise;
    globals.Date = this.previous?.Date ?? NativeDate;
    const target = globalThis as unknown as Record<string, unknown>;
    for (const [name, original] of this.replacedGlobals) target[name] = original;
    this.replacedGlobals = [];
  }

  /** Los timers del navegador directo al reloj falso (lo que harían los parches de zona si estuvieran). */
  private replaceTimerGlobals(): void {
    const target = globalThis as unknown as Record<string, unknown>;
    const scheduleAs =
      (kind: TimerKind) =>
      (fn: unknown, delay?: number, ...extra: unknown[]) =>
        typeof fn === "function"
          ? this.schedule(kind, (time) => fn(...(kind === "animationFrame" ? [time] : extra)), delay)
          : undefined;
    const replacements: Record<string, unknown> = {
      setTimeout: scheduleAs("timeout"),
      setInterval: scheduleAs("interval"),
      requestAnimationFrame: scheduleAs("animationFrame"),
      clearTimeout: (id: unknown) => void this.cancel(id),
      clearInterval: (id: unknown) => void this.cancel(id),
      cancelAnimationFrame: (id: unknown) => void this.cancel(id),
      queueMicrotask: (fn: () => void) => this.queueMicrotask(fn),
    };
    for (const [name, replacement] of Object.entries(replacements)) {
      this.replacedGlobals.push([name, target[name]]);
      target[name] = replacement;
    }
  }

  get now(): number {
    return this.realStart + this.elapsed;
  }

  schedule(kind: TimerKind, run: Run, delay?: number): number {
    const ms = kind === "animationFrame" ? FRAME_MS : Math.max(0, Number(delay) || 0);
    const timer: Timer = { id: this.nextId++, kind, run, time: this.elapsed + ms, seq: this.seq++ };
    if (kind === "interval") timer.period = ms;
    this.timers.push(timer);
    return timer.id;
  }

  cancel(id: unknown): boolean {
    const index = this.timers.findIndex((timer) => timer.id === id);
    if (index === -1) return false;
    this.timers.splice(index, 1);
    return true;
  }

  queueMicrotask(run: () => void): void {
    this.microtasks.push(run);
  }

  trackRejection(promise: FakePromise<unknown>, handled: boolean): void {
    if (handled) this.unhandled.delete(promise);
    else this.unhandled.add(promise);
  }

  /** Corre las microtasks (y las que agreguen) hasta vaciar la cola; un error o un rechazo sin manejar se tira al final. */
  flushMicrotasks(): void {
    let failure: { error: unknown } | undefined;
    for (let task = this.microtasks.shift(); task; task = this.microtasks.shift()) {
      try {
        task();
      } catch (error) {
        failure ??= { error };
      }
    }
    if (failure) throw failure.error;
    const [rejected] = this.unhandled;
    if (rejected) {
      this.unhandled.clear();
      const reason = rejected.reason;
      throw new Error(
        `Uncaught (in promise): ${reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason)}`,
        { cause: reason },
      );
    }
  }

  /** Avanza `ms`: corre en orden los timers que vencen (cada uno con sus microtasks), como `tick()` de Angular. */
  tick(ms = 0): void {
    this.flushMicrotasks();
    const target = this.elapsed + Math.max(0, ms);
    for (let timer = this.next(target); timer; timer = this.next(target)) this.fire(timer);
    this.elapsed = target;
  }

  /** Corre los timers no periódicos hasta que no quede ninguno (con los periódicos que venzan en el medio). */
  flush(maxTurns = 20): number {
    const start = this.elapsed;
    this.flushMicrotasks();
    for (let turns = 0; ; turns++) {
      const pending = this.timers.filter((timer) => timer.period === undefined).sort(FakeAsyncZone.order)[0];
      if (!pending) break;
      if (turns >= maxTurns) {
        throw new Error(
          `flush failed after reaching the limit of ${maxTurns} tasks. Does your code use a polling timeout?`,
        );
      }
      for (let timer = this.next(pending.time); timer; timer = this.next(pending.time)) this.fire(timer);
      this.elapsed = Math.max(this.elapsed, pending.time);
    }
    return this.elapsed - start;
  }

  discardPeriodicTasks(): void {
    this.timers = this.timers.filter((timer) => timer.period === undefined);
  }

  /** Lo que tendría que estar vacío al terminar `fakeAsync` (en Angular, un error). */
  pending(): { timers: number; periodic: number } {
    const periodic = this.timers.filter((timer) => timer.period !== undefined).length;
    return { timers: this.timers.length - periodic, periodic };
  }

  private next(until: number): Timer | undefined {
    return this.timers.filter((timer) => timer.time <= until).sort(FakeAsyncZone.order)[0];
  }

  private fire(timer: Timer): void {
    this.elapsed = timer.time;
    if (timer.period !== undefined) {
      // Un intervalo de 0 ms no puede volver a vencer en el mismo instante (sería un loop infinito).
      timer.time += Math.max(timer.period, 1);
      timer.seq = this.seq++;
    } else {
      this.timers.splice(this.timers.indexOf(timer), 1);
    }
    timer.run(timer.kind === "animationFrame" ? this.elapsed : undefined);
    this.flushMicrotasks();
  }

  private static order(a: Timer, b: Timer): number {
    return a.time - b.time || a.seq - b.seq;
  }
}

/** Corre una reacción en la zona donde se programó (digest al terminar), como un `.then` parcheado. */
function runInZone<T>(inside: boolean, fn: (value: unknown) => T, value: unknown): T {
  const zone = globals.ɵngjsZone;
  return zone ? zone.runIn(inside, fn as (...args: unknown[]) => T, undefined, [value]) : fn(value);
}

function enqueue(job: () => void): void {
  const zone = FakeAsyncZone.active;
  if (zone) zone.queueMicrotask(job);
  else NativePromise.resolve().then(job); // una promesa falsa que sobrevivió a su `fakeAsync`
}

type Settled<T> = { status: "fulfilled"; value: T } | { status: "rejected"; reason: unknown };

interface Reaction {
  onFulfilled?: ((value: unknown) => unknown) | null;
  onRejected?: ((reason: unknown) => unknown) | null;
  resolve(value: unknown): void;
  reject(reason: unknown): void;
  inside: boolean;
}

/** Promesa A+ cuyas reacciones van a la cola de microtasks del reloj falso (la `ZoneAwarePromise` de `fakeAsync`). */
class FakePromise<T> {
  private state: "pending" | "fulfilled" | "rejected" = "pending";
  private value: unknown;
  private reactions: Reaction[] = [];
  private handled = false;

  constructor(executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: unknown) => void) => void) {
    const { resolve, reject } = this.resolvers();
    try {
      executor(resolve, reject);
    } catch (error) {
      reject(error);
    }
  }

  get reason(): unknown {
    return this.value;
  }

  get [Symbol.toStringTag](): string {
    return "Promise";
  }

  // biome-ignore lint/suspicious/noThenProperty: es una promesa (la `ZoneAwarePromise` de `fakeAsync`).
  then<R1 = T, R2 = never>(
    onFulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): FakePromise<R1 | R2> {
    return new FakePromise<R1 | R2>((resolve, reject) => {
      const reaction: Reaction = {
        onFulfilled: onFulfilled as Reaction["onFulfilled"],
        onRejected: onRejected as Reaction["onRejected"],
        resolve: resolve as (value: unknown) => void,
        reject,
        inside: globals.ɵngjsZone ? globals.ɵngjsZone.inside() : true,
      };
      if (!this.handled) {
        this.handled = true;
        if (this.state === "rejected") FakeAsyncZone.active?.trackRejection(this as FakePromise<unknown>, true);
      }
      if (this.state === "pending") this.reactions.push(reaction);
      else this.schedule(reaction);
    });
  }

  catch<R = never>(onRejected?: ((reason: unknown) => R | PromiseLike<R>) | null): FakePromise<T | R> {
    return this.then(undefined, onRejected);
  }

  finally(onFinally?: (() => void) | null): FakePromise<T> {
    if (typeof onFinally !== "function") return this.then() as FakePromise<T>;
    return this.then(
      (value) => FakePromise.resolve(onFinally()).then(() => value),
      (reason) =>
        FakePromise.resolve(onFinally()).then(() => {
          throw reason;
        }),
    ) as FakePromise<T>;
  }

  static resolve<T>(value?: T | PromiseLike<T>): FakePromise<Awaited<T>> {
    if (value instanceof FakePromise) return value as FakePromise<Awaited<T>>;
    return new FakePromise((resolve) => resolve(value as Awaited<T>));
  }

  static reject<T = never>(reason?: unknown): FakePromise<T> {
    return new FakePromise<T>((_resolve, reject) => reject(reason));
  }

  static all<T>(values: Iterable<T | PromiseLike<T>>): FakePromise<Awaited<T>[]> {
    return FakePromise.combine(values, (items, resolve, reject) => {
      const results: Awaited<T>[] = [];
      let remaining = items.length;
      if (!remaining) resolve(results);
      items.forEach((item, index) => {
        FakePromise.resolve(item).then((value) => {
          results[index] = value as Awaited<T>;
          if (--remaining === 0) resolve(results);
        }, reject);
      });
    });
  }

  static allSettled<T>(values: Iterable<T | PromiseLike<T>>): FakePromise<Settled<Awaited<T>>[]> {
    return FakePromise.combine(values, (items, resolve) => {
      const results: Settled<Awaited<T>>[] = [];
      let remaining = items.length;
      if (!remaining) resolve(results);
      const done = (index: number, result: Settled<Awaited<T>>) => {
        results[index] = result;
        if (--remaining === 0) resolve(results);
      };
      items.forEach((item, index) => {
        FakePromise.resolve(item).then(
          (value) => done(index, { status: "fulfilled", value: value as Awaited<T> }),
          (reason) => done(index, { status: "rejected", reason }),
        );
      });
    });
  }

  static race<T>(values: Iterable<T | PromiseLike<T>>): FakePromise<Awaited<T>> {
    return FakePromise.combine(values, (items, resolve, reject) => {
      for (const item of items) FakePromise.resolve(item).then((value) => resolve(value as Awaited<T>), reject);
    });
  }

  static any<T>(values: Iterable<T | PromiseLike<T>>): FakePromise<Awaited<T>> {
    return FakePromise.combine(values, (items, resolve, reject) => {
      const errors: unknown[] = [];
      let remaining = items.length;
      const fail = () => reject(new AggregateError(errors, "All promises were rejected"));
      if (!remaining) fail();
      items.forEach((item, index) => {
        FakePromise.resolve(item).then(
          (value) => resolve(value as Awaited<T>),
          (reason) => {
            errors[index] = reason;
            if (--remaining === 0) fail();
          },
        );
      });
    });
  }

  private static combine<T, R>(
    values: Iterable<T | PromiseLike<T>>,
    body: (items: (T | PromiseLike<T>)[], resolve: (value: R) => void, reject: (reason: unknown) => void) => void,
  ): FakePromise<R> {
    return new FakePromise<R>((resolve, reject) => body(Array.from(values), resolve as (value: R) => void, reject));
  }

  /** `resolve`/`reject` que solo valen la primera vez (como los de una promesa nativa). */
  private resolvers(): { resolve: (value: unknown) => void; reject: (reason: unknown) => void } {
    let called = false;
    return {
      resolve: (value) => {
        if (called) return;
        called = true;
        this.adopt(value);
      },
      reject: (reason) => {
        if (called) return;
        called = true;
        this.settle("rejected", reason);
      },
    };
  }

  /** El "resolve" de la especificación: una promesa o thenable se sigue (en una microtask); otro valor, se cumple. */
  private adopt(value: unknown): void {
    if (value === this) {
      this.settle("rejected", new TypeError("Chaining cycle detected for promise"));
      return;
    }
    if (value !== null && (typeof value === "object" || typeof value === "function")) {
      let then: unknown;
      try {
        then = (value as { then?: unknown }).then;
      } catch (error) {
        this.settle("rejected", error);
        return;
      }
      if (typeof then === "function") {
        enqueue(() => {
          const { resolve, reject } = this.resolvers();
          try {
            (then as (resolve: unknown, reject: unknown) => void).call(value, resolve, reject);
          } catch (error) {
            reject(error);
          }
        });
        return;
      }
    }
    this.settle("fulfilled", value);
  }

  private settle(state: "fulfilled" | "rejected", value: unknown): void {
    if (this.state !== "pending") return;
    this.state = state;
    this.value = value;
    if (state === "rejected" && !this.handled)
      FakeAsyncZone.active?.trackRejection(this as FakePromise<unknown>, false);
    const reactions = this.reactions;
    this.reactions = [];
    for (const reaction of reactions) this.schedule(reaction);
  }

  private schedule(reaction: Reaction): void {
    enqueue(() => {
      const handler = this.state === "fulfilled" ? reaction.onFulfilled : reaction.onRejected;
      if (typeof handler !== "function") {
        if (this.state === "fulfilled") reaction.resolve(this.value);
        else reaction.reject(this.value);
        return;
      }
      try {
        reaction.resolve(runInZone(reaction.inside, handler, this.value));
      } catch (error) {
        reaction.reject(error);
      }
    });
  }
}

/** `Date` con el reloj falso: `Date.now()` y `new Date()` avanzan con `tick()`. */
class FakeDate {
  static of(zone: FakeAsyncZone): DateConstructor {
    const Fake = function (this: unknown, ...args: unknown[]) {
      if (!new.target) return new NativeDate(zone.now).toString();
      return args.length
        ? new (NativeDate as unknown as new (...a: unknown[]) => Date)(...args)
        : new NativeDate(zone.now);
    } as unknown as DateConstructor;
    Object.setPrototypeOf(Fake, NativeDate);
    Object.defineProperty(Fake, "prototype", { value: NativeDate.prototype });
    Object.defineProperty(Fake, "now", { value: () => zone.now, configurable: true, writable: true });
    return Fake;
  }
}

type Defer = ((fn: () => void, delay?: number, taskType?: string) => unknown) & { cancel(id: unknown): boolean };

/**
 * `$browser` de `ngMock` (el que trae `TestBed`): su `defer` — lo que usan `$timeout`, `$evalAsync` fuera de digest,
 * etc. — encola para `$timeout.flush()` en vez de usar `setTimeout`. Mientras hay un `fakeAsync` activo agenda en el
 * reloj falso (por `setTimeout`, que los parches le entregan), así `tick()` controla todo el tiempo, como en Angular;
 * `$evalAsync`/`$applyAsync` van como microtasks. Afuera, la cola de `ngMock` de siempre.
 */
export class FakeAsyncBrowser {
  static readonly decorator = [
    "$provide",
    ($provide: { decorator(name: string, fn: unknown[]): void }) =>
      $provide.decorator("$browser", [
        "$delegate",
        ($browser: { defer: Defer }) => FakeAsyncBrowser.decorate($browser),
      ]),
  ];

  static decorate<B extends { defer: Defer }>($browser: B): B {
    const original = $browser.defer;
    const fakeIds = new Set<unknown>();
    const microIds = new Set<unknown>();
    let microCount = 0;
    const defer = function (this: unknown, fn: () => void, delay?: number, taskType?: string): unknown {
      const zone = FakeAsyncZone.active;
      if (!zone) return original.call(this, fn, delay, taskType);
      // `$evalAsync`/`$applyAsync` fuera de un digest: AngularJS solo agenda que haya un digest pronto — como una
      // microtask (corre en `flushMicrotasks()`/`tick()`), no un timer que quede pendiente al terminar.
      if (taskType === "$evalAsync" || taskType === "$applyAsync") {
        const id = `ɵngjsMicrotask${++microCount}`;
        microIds.add(id);
        zone.queueMicrotask(() => {
          if (microIds.delete(id)) fn();
        });
        return id;
      }
      const id = setTimeout(() => {
        fakeIds.delete(id);
        fn();
      }, delay ?? 0);
      fakeIds.add(id);
      return id;
    } as Defer;
    Object.assign(defer, original);
    defer.cancel = (id: unknown) => {
      if (microIds.delete(id)) return true;
      if (!fakeIds.delete(id)) return original.cancel(id);
      clearTimeout(id as number);
      return true;
    };
    $browser.defer = defer;
    return $browser;
  }
}

/**
 * Envuelve un test para que corra con el reloj falso (como `fakeAsync` de Angular). Al terminar corre las microtasks y,
 * si quedan timers, es error (`{ flush: true }` los corre antes).
 */
export function fakeAsync<A extends unknown[], R>(
  fn: (...args: A) => R,
  options?: { flush?: boolean },
): (...args: A) => R {
  return function (this: unknown, ...args: A): R {
    const zone = FakeAsyncZone.start();
    try {
      const result = fn.apply(this, args);
      if (options?.flush) zone.flush();
      else zone.flushMicrotasks();
      const { timers, periodic } = zone.pending();
      if (periodic > 0) throw new Error(`${periodic} periodic timer(s) still in the queue.`);
      if (timers > 0) throw new Error(`${timers} timer(s) still in the queue.`);
      return result;
    } finally {
      zone.stop();
    }
  };
}

/** Avanza el reloj falso `millis` ms, corriendo lo que venza (y las microtasks). */
export function tick(millis = 0): void {
  FakeAsyncZone.current().tick(millis);
}

/** Corre todos los timers no periódicos; devuelve los ms que avanzó el reloj. */
export function flush(maxTurns?: number): number {
  return FakeAsyncZone.current().flush(maxTurns);
}

export function flushMicrotasks(): void {
  FakeAsyncZone.current().flushMicrotasks();
}

/** Descarta los intervalos pendientes (sin esto, `fakeAsync` termina con error si queda alguno). */
export function discardPeriodicTasks(): void {
  FakeAsyncZone.current().discardPeriodicTasks();
}

/**
 * Programador de `waitForAsync`: agenda de verdad (a través de los mismos parches) y cuenta lo pendiente, para saber
 * cuándo el test ya no tiene trabajo async (salvo intervalos, que no terminan nunca).
 */
class PendingTasks implements SchedulerLike {
  private readonly ids = new Set<unknown>();
  private idle: (() => void) | undefined;
  /** Los timers como estaban al empezar (con parches, los parcheados; si no, los del navegador). */
  private readonly timers = {
    setTimeout: globalThis.setTimeout,
    setInterval: globalThis.setInterval,
    clearTimeout: globalThis.clearTimeout,
    requestAnimationFrame: globalThis.requestAnimationFrame as typeof globalThis.requestAnimationFrame | undefined,
    queueMicrotask: globalThis.queueMicrotask,
  };
  private replacedGlobals: [string, unknown][] = [];

  constructor(private readonly previous: SchedulerLike | undefined) {}

  /** Con los parches, el hook; sin ellos, los globales (como `FakeAsyncZone.replaceTimerGlobals`). */
  install(): void {
    globals.ɵngjsFakeAsync = this;
    if (globals.ɵngjsZone) return;
    const target = globalThis as unknown as Record<string, unknown>;
    const scheduleAs =
      (kind: TimerKind) =>
      (fn: unknown, delay?: number, ...extra: unknown[]) =>
        typeof fn === "function"
          ? this.schedule(kind, (time) => fn(...(kind === "animationFrame" ? [time] : extra)), delay)
          : undefined;
    const replacements: Record<string, unknown> = {
      setTimeout: scheduleAs("timeout"),
      setInterval: scheduleAs("interval"),
      clearTimeout: (id: unknown) => {
        this.cancel(id);
        this.timers.clearTimeout(id as never);
      },
    };
    if (this.timers.requestAnimationFrame) replacements.requestAnimationFrame = scheduleAs("animationFrame");
    for (const [name, replacement] of Object.entries(replacements)) {
      this.replacedGlobals.push([name, target[name]]);
      target[name] = replacement;
    }
  }

  uninstall(): void {
    globals.ɵngjsFakeAsync = this.previous;
    const target = globalThis as unknown as Record<string, unknown>;
    for (const [name, original] of this.replacedGlobals) target[name] = original;
    this.replacedGlobals = [];
  }

  schedule(kind: TimerKind, run: Run, delay?: number): unknown {
    const { setTimeout: later, setInterval: every, requestAnimationFrame: frame } = this.timers;
    const id = this.native(() => {
      if (kind === "interval") return every(run, delay);
      if (kind === "animationFrame" && frame) return frame((time) => this.finish(id, () => run(time)));
      return later(() => this.finish(id, run), delay);
    });
    if (kind !== "interval") this.ids.add(id);
    return id;
  }

  cancel(id: unknown): boolean {
    if (this.ids.delete(id)) this.check();
    return false; // el id es del navegador: que lo cancele él
  }

  queueMicrotask(run: () => void): void {
    this.native(() => this.timers.queueMicrotask(run));
  }

  /** Resuelve cuando no queda nada pendiente durante una vuelta de macrotask (las promesas pueden agendar más). */
  whenIdle(): Promise<void> {
    return new NativePromise((resolve) => {
      this.idle = resolve;
      this.check();
    });
  }

  private finish(id: unknown, run: () => void): void {
    try {
      run();
    } finally {
      this.ids.delete(id);
      this.check();
    }
  }

  private check(): void {
    if (!this.idle || this.ids.size) return;
    this.native(() =>
      this.timers.setTimeout(() => {
        if (this.ids.size || !this.idle) return;
        const idle = this.idle;
        this.idle = undefined;
        idle();
      }),
    );
  }

  /** Agenda por los parches sin pasar por este programador (si no, se llamaría a sí mismo). */
  private native<T>(schedule: () => T): T {
    const current = globals.ɵngjsFakeAsync;
    globals.ɵngjsFakeAsync = this.previous;
    try {
      return schedule();
    } finally {
      globals.ɵngjsFakeAsync = current;
    }
  }
}

/**
 * Envuelve un test para que termine cuando termina todo su trabajo async (timers, frames y la promesa que devuelva),
 * como `waitForAsync` de Angular.
 */
export function waitForAsync<A extends unknown[]>(fn: (...args: A) => unknown): (...args: A) => Promise<void> {
  return async function (this: unknown, ...args: A): Promise<void> {
    if (FakeAsyncZone.active) throw new Error("waitForAsync() no se puede usar dentro de fakeAsync().");
    const tasks = new PendingTasks(globals.ɵngjsFakeAsync);
    tasks.install();
    try {
      await fn.apply(this, args);
      await tasks.whenIdle();
    } finally {
      tasks.uninstall();
    }
  };
}
