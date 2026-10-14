import angular from "angular";
// Trae el augment de `@types/angular-animate` sobre el namespace `angular` (`$animateCss`).
import "angular-animate";
import { type AnimationPlayer, NoopAnimationPlayer, ɵCallbackBag } from "@/animations/animation-player.ts";
import type { ɵStyleData, ɵStyleDataMap } from "@/animations/dsl.ts";
import { Inject } from "@/core/di/inject.ts";
import { Injectable } from "@/core/di/injectable.ts";

/**
 * `AnimationDriver` de `@angular/animations/browser` — la capa que **ejecuta** un
 * tramo de animación sobre un elemento. El builder (y lo que interprete la DSL)
 * solo arma keyframes + tiempos y se los pasa a `animate()`; con qué se anima lo
 * decide el driver provisto por DI:
 *
 * - `BrowserAnimationsModule` / `provideAnimations()` → `ɵAnimateCssDriver` (`$animateCss` de `ngAnimate`).
 * - `NoopAnimationsModule` / `provideNoopAnimations()` → `ɵNoopAnimationDriver`.
 * - Un consumidor puede pisarlo: `{ provide: AnimationDriver, useClass: MiDriver }`.
 *
 * Como en Angular: `duration` / `delay` van en **ms**, cada keyframe es un `Map`
 * de estilos con su `offset` (0→1), y el player que devuelve `animate()` no
 * arranca hasta `play()`.
 */

/** `$animateCss` de `ngAnimate` — tipos vía `@types/angular-animate` (augment de `"angular"`). */
type IAnimateCssService = angular.animate.IAnimateCssService;
type IAnimateCssRunner = angular.animate.IAnimateCssRunner;

// --- Helpers de DOM compartidos por los drivers ---------------------------

function validateStyleProperty(prop: string): boolean {
  if (typeof document === "undefined" || !document.body) return true;
  if (prop in document.body.style) return true;
  // `webkitTransform` y compañía: el navegador los expone capitalizados.
  if (prop.startsWith("webkit")) return `W${prop.slice(1)}` in document.body.style;
  return false;
}

function getParentElement(element: unknown): unknown {
  const node = element as Node & { host?: unknown };
  return node.parentNode || node.host || null; // `host` = el dueño de un ShadowRoot
}

function containsElement(elm1: unknown, elm2: unknown): boolean {
  let current: unknown = elm2;
  while (current) {
    if (current === elm1) return true;
    current = getParentElement(current);
  }
  return false;
}

function invokeQuery(element: unknown, selector: string, multi: boolean): unknown[] {
  const root = element as Element;
  if (multi) return Array.from(root.querySelectorAll(selector));
  const found = root.querySelector(selector);
  return found ? [found] : [];
}

function matchesElement(element: unknown, selector: string): boolean {
  return (element as Element).matches(selector);
}

// --- Driver no-op ---------------------------------------------------------

/** No anima: `animate()` devuelve un `NoopAnimationPlayer`. Lo provee `NoopAnimationsModule`. */
@Injectable()
export class ɵNoopAnimationDriver implements AnimationDriver {
  validateStyleProperty(prop: string): boolean {
    return validateStyleProperty(prop);
  }
  matchesElement(element: unknown, selector: string): boolean {
    return matchesElement(element, selector);
  }
  containsElement(elm1: unknown, elm2: unknown): boolean {
    return containsElement(elm1, elm2);
  }
  getParentElement(element: unknown): unknown {
    return getParentElement(element);
  }
  query(element: unknown, selector: string, multi: boolean): unknown[] {
    return invokeQuery(element, selector, multi);
  }
  computeStyle(_element: unknown, _prop: string, defaultValue?: string): string {
    return defaultValue || "";
  }
  animate(
    _element: unknown,
    _keyframes: Array<ɵStyleDataMap>,
    duration: number,
    delay: number,
    _easing?: string | null,
    _previousPlayers?: AnimationPlayer[],
    _scrubberAccessRequested?: boolean,
  ): AnimationPlayer {
    return new NoopAnimationPlayer(duration + delay);
  }
}

// --- Token ----------------------------------------------------------------

@Injectable()
export abstract class AnimationDriver {
  static NOOP: AnimationDriver = new ɵNoopAnimationDriver();

  abstract validateStyleProperty(prop: string): boolean;
  /** @deprecated Angular ya no lo usa; queda por paridad de firma. */
  abstract matchesElement(element: unknown, selector: string): boolean;
  abstract containsElement(elm1: unknown, elm2: unknown): boolean;
  abstract getParentElement(element: unknown): unknown;
  abstract query(element: unknown, selector: string, multi: boolean): unknown[];
  abstract computeStyle(element: unknown, prop: string, defaultValue?: string): string;
  abstract animate(
    element: unknown,
    keyframes: Array<ɵStyleDataMap>,
    duration: number,
    delay: number,
    easing?: string | null,
    previousPlayers?: AnimationPlayer[],
    scrubberAccessRequested?: boolean,
  ): AnimationPlayer;
}

// --- Driver sobre `$animateCss` -------------------------------------------

function keyframeToStyles(keyframe: ɵStyleDataMap): ɵStyleData {
  const styles: ɵStyleData = {};
  for (const [prop, value] of keyframe) if (prop !== "offset") styles[prop] = value;
  return styles;
}

/**
 * Un tramo sobre `$animateCss`. El runner se crea recién en `play()`: crear el
 * runner ya aplica los estilos `from` al elemento.
 *
 * **Brechas**: `$animateCss` es una transición CSS `from → to`, así que de N
 * keyframes solo se usan el primero y el último, y no hay control de posición →
 * `pause()` / `setPosition()` son no-op y `getPosition()` es binario (0 ó 1).
 */
class AnimateCssPlayer implements AnimationPlayer {
  readonly totalTime: number;

  private started = false;
  private finished = false;
  private runner: IAnimateCssRunner | null = null;
  private readonly startBag = new ɵCallbackBag();
  private readonly doneBag = new ɵCallbackBag();
  private readonly destroyBag = new ɵCallbackBag();

  constructor(
    private readonly $animateCss: IAnimateCssService,
    private readonly element: Element,
    private readonly keyframes: Array<ɵStyleDataMap>,
    private readonly duration: number,
    private readonly delay: number,
    private readonly easing: string | null,
  ) {
    this.totalTime = duration + delay;
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

    // Un único keyframe en offset 0 es solo punto de partida; cualquier otro último frame es el destino.
    const last = this.keyframes[this.keyframes.length - 1];
    const to = last && last.get("offset") !== 0 ? last : null;
    const first = this.keyframes[0];
    const from = first && first !== to ? first : null;

    this.runner = this.$animateCss(angular.element(this.element as HTMLElement), {
      from: from ? keyframeToStyles(from) : undefined,
      to: to ? keyframeToStyles(to) : undefined,
      // `$animateCss` trabaja en segundos (`1` = 1000ms).
      duration: this.duration / 1000 || undefined,
      delay: this.delay / 1000 || undefined,
      easing: this.easing ?? undefined,
    });
    const settle = () => this.complete();
    Promise.resolve(this.runner.start()).then(settle, settle);
  }

  finish(): void {
    try {
      this.runner?.end();
    } catch {
      // `end()` sobre un runner ya terminado tira — no importa.
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
    this.runner = null;
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
}

/**
 * `AnimationDriver` sobre `$animateCss` de `ngAnimate` — el lugar que en Angular
 * ocupa `ɵWebAnimationsDriver`. Lo provee `BrowserAnimationsModule` /
 * `provideAnimations()`.
 */
@Injectable()
export class ɵAnimateCssDriver implements AnimationDriver {
  constructor(@Inject("$animateCss") private readonly $animateCss: IAnimateCssService) {}

  validateStyleProperty(prop: string): boolean {
    return validateStyleProperty(prop);
  }
  matchesElement(element: unknown, selector: string): boolean {
    return matchesElement(element, selector);
  }
  containsElement(elm1: unknown, elm2: unknown): boolean {
    return containsElement(elm1, elm2);
  }
  getParentElement(element: unknown): unknown {
    return getParentElement(element);
  }
  query(element: unknown, selector: string, multi: boolean): unknown[] {
    return invokeQuery(element, selector, multi);
  }
  computeStyle(element: unknown, prop: string, _defaultValue?: string): string {
    return (window.getComputedStyle(element as Element) as unknown as Record<string, string>)[prop];
  }
  animate(
    element: unknown,
    keyframes: Array<ɵStyleDataMap>,
    duration: number,
    delay: number,
    easing?: string | null,
    _previousPlayers?: AnimationPlayer[],
    _scrubberAccessRequested?: boolean,
  ): AnimationPlayer {
    return new AnimateCssPlayer(this.$animateCss, element as Element, keyframes, duration, delay, easing ?? null);
  }
}
