import angular from "angular";
// Trae el augment de `@types/angular-animate` sobre el namespace `angular` (`$animateCss`).
import "angular-animate";
import { AnimationMetadataType } from "@/animations/animation-metadata.ts";
import type {
  AnimationAnimateMetadata,
  AnimationGroupMetadata,
  AnimationKeyframesSequenceMetadata,
  AnimationMetadata,
  AnimationOptions,
  AnimationReferenceMetadata,
  AnimationSequenceMetadata,
  AnimationStyleMetadata,
  ɵStyleData,
} from "@/animations/dsl.ts";

/**
 * API **imperativa** de animación — el par `AnimationBuilder` / `AnimationFactory`
 * / `AnimationPlayer` de `@angular/animations`, acá sobre `$animateCss` de
 * `ngAnimate`.
 *
 * A diferencia de la DSL declarativa (`trigger`/`state` + `[@trigger]` en el
 * template), esto se usa desde código: `inject(AnimationBuilder).build(pasos)`
 * → `factory.create(elemento)` → `player.play()`. Sin máquina de estados; el
 * ciclo de vida (`play`/`finish`/`destroy`) lo maneja el consumidor.
 *
 * **Brechas** (ver `CONCEPTOS.md` "Animaciones"): `$animateCss` no expone control
 * de posición → `pause()` / `setPosition()` son no-op y `getPosition()` es
 * binario (0 ó 1). `keyframes()` sin `@keyframes` generado → se usa el último
 * frame como destino. `query()` / `stagger()` / `animateChild()` dentro de
 * `build()` se ignoran.
 */

/** `$animateCss` de `ngAnimate` — tipos vía `@types/angular-animate` (augment de `"angular"`). */
type IAnimateCssService = angular.animate.IAnimateCssService;
type IAnimateCssRunner = angular.animate.IAnimateCssRunner;

// --- Contrato de player -------------------------------------------------

export interface AnimationPlayer {
  play(): void;
  pause(): void;
  finish(): void;
  reset(): void;
  restart(): void;
  destroy(): void;
  init(): void;
  hasStarted(): boolean;
  onStart(fn: () => void): void;
  onDone(fn: () => void): void;
  onDestroy(fn: () => void): void;
  setPosition(position: number): void;
  getPosition(): number;
  readonly totalTime: number;
}

export abstract class AnimationFactory {
  abstract create(element: unknown, options?: AnimationOptions): AnimationPlayer;
}

/**
 * Token DI (`$name`). El modo runtime lo bindea a `BrowserAnimationBuilder`
 * (con `ngAnimate`) o a un builder no-op (`NoopAnimationsModule`).
 */
export abstract class AnimationBuilder {
  static readonly $name = "AnimationBuilder";
  abstract build(animation: AnimationMetadata | AnimationMetadata[]): AnimationFactory;
}

// --- Aplanado de la metadata a segmentos de `$animateCss` -------------
//
// Un "segmento" = una llamada a `$animateCss(el, { from, to, duration, delay, easing })`.
// Estos dos helpers los reusa también la directiva `[@trigger]` que genera el CLI.

export interface ɵAnimationSegment {
  from: ɵStyleData | null;
  to: ɵStyleData | null;
  /** segundos (`$animateCss`: `1` = 1000ms). */
  duration: number;
  /** segundos. */
  delay: number;
  easing: string | null;
}

/** `"300ms"` · `"0.3s ease-in"` · `"300ms 100ms ease-out"` · `300` (= ms) → segundos. */
export function ɵparseAnimationTimings(timings: string | number): {
  duration: number;
  delay: number;
  easing: string | null;
} {
  if (typeof timings === "number") return { duration: timings / 1000, delay: 0, easing: null };

  const TIME = /^(-?[\d.]+)(ms|s)?/;
  const toSeconds = (value: string, unit?: string): number => {
    const n = Number.parseFloat(value);
    return unit === "s" ? n : n / 1000; // bare number en un timing string = ms
  };

  let rest = timings.trim();
  const durationMatch = rest.match(TIME);
  if (!durationMatch) return { duration: 0, delay: 0, easing: null };
  const duration = toSeconds(durationMatch[1], durationMatch[2]);
  rest = rest.slice(durationMatch[0].length).trim();

  let delay = 0;
  const delayMatch = rest.match(TIME);
  if (delayMatch) {
    delay = toSeconds(delayMatch[1], delayMatch[2]);
    rest = rest.slice(delayMatch[0].length).trim();
  }

  return { duration, delay, easing: rest || null };
}

function styleTokensToMap(node: AnimationStyleMetadata | AnimationKeyframesSequenceMetadata | null): ɵStyleData | null {
  if (!node) return null;
  if (node.type === AnimationMetadataType.Keyframes) {
    // Brecha: sin `@keyframes` generado, el destino es el último frame.
    const steps = node.steps;
    return steps.length ? styleTokensToMap(steps[steps.length - 1]) : null;
  }
  const styles = node.styles;
  if (styles === "*") return null;
  if (Array.isArray(styles)) {
    const merged: ɵStyleData = {};
    for (const entry of styles) if (entry !== "*") Object.assign(merged, entry);
    return merged;
  }
  return styles;
}

/**
 * Camina los pasos de `build()` y produce los segmentos de `$animateCss`. Un
 * `sequence([...])` corre en orden; un `group([...])` en paralelo; un
 * `style()` suelto acumula el `from` del próximo `animate()`.
 */
export function ɵflattenAnimationToSegments(steps: AnimationMetadata | AnimationMetadata[]): {
  segments: ɵAnimationSegment[];
  parallel: boolean;
} {
  let list = Array.isArray(steps) ? steps : [steps];
  let parallel = false;

  if (list.length === 1 && list[0]) {
    const only = list[0];
    if (only.type === AnimationMetadataType.Sequence) {
      list = (only as AnimationSequenceMetadata).steps;
    } else if (only.type === AnimationMetadataType.Group) {
      list = (only as AnimationGroupMetadata).steps;
      parallel = true;
    } else if (only.type === AnimationMetadataType.Reference) {
      const inner = (only as AnimationReferenceMetadata).animation;
      list = Array.isArray(inner) ? inner : [inner];
    }
  }

  const segments: ɵAnimationSegment[] = [];
  let pendingFrom: ɵStyleData | null = null;

  for (const node of list) {
    if (!node) continue;
    if (node.type === AnimationMetadataType.Style) {
      pendingFrom = { ...(pendingFrom ?? {}), ...(styleTokensToMap(node as AnimationStyleMetadata) ?? {}) };
      continue;
    }
    if (node.type === AnimationMetadataType.Animate) {
      const animate = node as AnimationAnimateMetadata;
      const { duration, delay, easing } = ɵparseAnimationTimings(animate.timings);
      segments.push({ from: pendingFrom, to: styleTokensToMap(animate.styles), duration, delay, easing });
      pendingFrom = null;
    }
    // group/sequence anidados, query, stagger, animateChild, animateRef → brecha (se ignoran).
  }

  // `[style({...})]` sin `animate` → aplicar el estilo de una (segmento instantáneo).
  if (pendingFrom && segments.length === 0) {
    segments.push({ from: null, to: pendingFrom, duration: 0, delay: 0, easing: null });
  }

  return { segments, parallel };
}

// --- Player no-op (fallback y `NoopAnimationsModule`) -----------------

class CallbackBag {
  private readonly fns: Array<() => void> = [];
  add(fn: () => void): void {
    this.fns.push(fn);
  }
  flush(): void {
    const pending = this.fns.splice(0);
    for (const fn of pending) fn();
  }
}

/**
 * `AnimationPlayer` que no anima: aplica `onStart`, agenda `onDone` en una
 * microtask y termina. Lo devuelve `NoopAnimationsModule` y también el builder
 * real cuando la metadata no produce ningún segmento.
 */
export class NoopAnimationPlayer implements AnimationPlayer {
  private started = false;
  private finished = false;
  private readonly startBag = new CallbackBag();
  private readonly doneBag = new CallbackBag();
  private readonly destroyBag = new CallbackBag();

  constructor(public readonly totalTime = 0) {}

  init(): void {}
  hasStarted(): boolean {
    return this.started;
  }
  onStart(fn: () => void): void {
    this.startBag.add(fn);
  }
  onDone(fn: () => void): void {
    this.doneBag.add(fn);
  }
  onDestroy(fn: () => void): void {
    this.destroyBag.add(fn);
  }

  play(): void {
    if (this.started) return;
    this.started = true;
    this.startBag.flush();
    queueMicrotask(() => this.finish());
  }

  finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.doneBag.flush();
  }

  pause(): void {}
  setPosition(): void {}
  getPosition(): number {
    return this.finished ? 1 : 0;
  }
  reset(): void {
    this.started = false;
    this.finished = false;
  }
  restart(): void {
    this.reset();
    this.play();
  }
  destroy(): void {
    this.reset();
    this.destroyBag.flush();
  }
}

// --- Player / factory / builder sobre `$animateCss` ------------------

class BrowserAnimationPlayer implements AnimationPlayer {
  readonly totalTime: number;

  private started = false;
  private finished = false;
  private readonly runners: IAnimateCssRunner[] = [];
  private readonly startBag = new CallbackBag();
  private readonly doneBag = new CallbackBag();
  private readonly destroyBag = new CallbackBag();

  constructor(
    private readonly $animateCss: IAnimateCssService,
    private readonly element: Element,
    private readonly segments: ɵAnimationSegment[],
    private readonly parallel: boolean,
    private readonly initialDelay: number,
  ) {
    const body = segments.reduce((acc, seg) => {
      const ms = (seg.delay + seg.duration) * 1000;
      return parallel ? Math.max(acc, ms) : acc + ms;
    }, 0);
    this.totalTime = initialDelay * 1000 + body;
  }

  init(): void {}
  hasStarted(): boolean {
    return this.started;
  }
  onStart(fn: () => void): void {
    this.startBag.add(fn);
  }
  onDone(fn: () => void): void {
    this.doneBag.add(fn);
  }
  onDestroy(fn: () => void): void {
    this.destroyBag.add(fn);
  }

  play(): void {
    if (this.started) return;
    this.started = true;
    this.startBag.flush();

    if (this.segments.length === 0) {
      queueMicrotask(() => this.complete());
      return;
    }

    const $el = angular.element(this.element as HTMLElement);
    const startSegment = (seg: ɵAnimationSegment): Promise<unknown> => {
      const runner = this.$animateCss($el, {
        from: seg.from ?? undefined,
        to: seg.to ?? undefined,
        duration: seg.duration || undefined,
        delay: seg.delay || this.consumeInitialDelay() || undefined,
        easing: seg.easing ?? undefined,
      });
      this.runners.push(runner);
      return Promise.resolve(runner.start());
    };
    const settle = () => this.complete();

    if (this.parallel) {
      Promise.all(this.segments.map(startSegment)).then(settle, settle);
    } else {
      this.segments
        .reduce((chain, seg) => chain.then(() => startSegment(seg)), Promise.resolve<unknown>(undefined))
        .then(settle, settle);
    }
  }

  finish(): void {
    for (const runner of this.runners) {
      try {
        runner.end();
      } catch {
        // `end()` sobre un runner ya terminado tira — no importa.
      }
    }
    this.complete();
  }

  pause(): void {
    // Brecha: `$animateCss` no da pausa/reanudación.
  }
  setPosition(): void {}
  getPosition(): number {
    return this.finished ? 1 : 0;
  }

  reset(): void {
    this.started = false;
    this.finished = false;
    this.runners.length = 0;
    this.delayConsumed = false;
  }
  restart(): void {
    this.reset();
    this.play();
  }
  destroy(): void {
    this.finish();
    this.reset();
    this.destroyBag.flush();
  }

  private complete(): void {
    if (this.finished) return;
    this.finished = true;
    this.doneBag.flush();
  }

  private delayConsumed = false;
  /** El `delay` de `create(el, { delay })` se aplica solo al primer segmento. */
  private consumeInitialDelay(): number {
    if (this.delayConsumed || !this.initialDelay) return 0;
    this.delayConsumed = true;
    return this.initialDelay;
  }
}

class BrowserAnimationFactory extends AnimationFactory {
  constructor(
    private readonly $animateCss: IAnimateCssService,
    private readonly segments: ɵAnimationSegment[],
    private readonly parallel: boolean,
  ) {
    super();
  }

  create(element: unknown, options?: AnimationOptions): AnimationPlayer {
    if (this.segments.length === 0) return new NoopAnimationPlayer();
    const rawDelay = options?.delay ?? 0;
    const delay = typeof rawDelay === "number" ? rawDelay / 1000 : ɵparseAnimationTimings(rawDelay).duration;
    return new BrowserAnimationPlayer(this.$animateCss, element as Element, this.segments, this.parallel, delay);
  }
}

/**
 * `AnimationBuilder` sobre `$animateCss` de `ngAnimate`. Lo provee el módulo de
 * runtime cuando `ngAnimate` está cargado (`BrowserAnimationsModule` /
 * `provideAnimations()`).
 */
export class BrowserAnimationBuilder extends AnimationBuilder {
  static readonly $inject = ["$animateCss"] as const;

  constructor(private readonly $animateCss: IAnimateCssService) {
    super();
  }

  build(animation: AnimationMetadata | AnimationMetadata[]): AnimationFactory {
    const { segments, parallel } = ɵflattenAnimationToSegments(animation);
    return new BrowserAnimationFactory(this.$animateCss, segments, parallel);
  }
}

/** `AnimationBuilder` no-op — lo provee `NoopAnimationsModule`. */
export class NoopAnimationBuilder extends AnimationBuilder {
  build(): AnimationFactory {
    return new NoopAnimationFactory();
  }
}

class NoopAnimationFactory extends AnimationFactory {
  create(): AnimationPlayer {
    return new NoopAnimationPlayer();
  }
}
