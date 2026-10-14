import { AnimationMetadataType } from "@/animations/animation-metadata.ts";
import { type AnimationPlayer, NoopAnimationPlayer, ɵCallbackBag } from "@/animations/animation-player.ts";
import type { AnimationDriver } from "@/animations/browser/animation-driver.ts";
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
  ɵStyleDataMap,
} from "@/animations/dsl.ts";
import { Injectable } from "@/core/di/injectable.ts";

/**
 * API **imperativa** de animación — el par `AnimationBuilder` / `AnimationFactory`
 * / `AnimationPlayer` de `@angular/animations`.
 *
 * A diferencia de la DSL declarativa (`trigger`/`state` + `[@trigger]` en el
 * template), esto se usa desde código: `inject(AnimationBuilder).build(pasos)`
 * → `factory.create(elemento)` → `player.play()`. Sin máquina de estados; el
 * ciclo de vida (`play`/`finish`/`destroy`) lo maneja el consumidor.
 *
 * Como en Angular, el builder solo **interpreta** la metadata (la aplana a
 * segmentos de keyframes + tiempos); cada segmento lo **ejecuta** el
 * `AnimationDriver` provisto por DI (`ngjs-core/animations/browser`).
 *
 * **Brechas**: `query()` / `stagger()` / `animateChild()` y `group`/`sequence`
 * anidados dentro de `build()` se ignoran. Pausa, posición y keyframes
 * intermedios dependen del driver (el de `$animateCss` no los da).
 */

export abstract class AnimationFactory {
  abstract create(element: unknown, options?: AnimationOptions): AnimationPlayer;
}

/** Token DI (`$name`). Los módulos de animación lo bindean a `BrowserAnimationBuilder`. */
@Injectable()
export abstract class AnimationBuilder {
  abstract build(animation: AnimationMetadata | AnimationMetadata[]): AnimationFactory;
}

// --- Aplanado de la metadata a segmentos del driver ---------------------
//
// Un "segmento" = una llamada a `driver.animate(el, keyframes, duration, delay, easing)`.

export interface ɵAnimationSegment {
  /** Estilos por `offset` (0→1). Un solo frame en offset 1 = "desde donde esté el elemento". */
  keyframes: Array<ɵStyleDataMap>;
  /** ms. */
  duration: number;
  /** ms. */
  delay: number;
  easing: string | null;
}

/** `"300ms"` · `"0.3s ease-in"` · `"300ms 100ms ease-out"` · `300` (= ms) → ms. */
export function ɵparseAnimationTimings(timings: string | number): {
  duration: number;
  delay: number;
  easing: string | null;
} {
  if (typeof timings === "number") return { duration: timings, delay: 0, easing: null };

  const TIME = /^(-?[\d.]+)(ms|s)?/;
  const toMs = (value: string, unit?: string): number => {
    const n = Number.parseFloat(value);
    return unit === "s" ? n * 1000 : n; // bare number en un timing string = ms
  };

  let rest = timings.trim();
  const durationMatch = rest.match(TIME);
  if (!durationMatch) return { duration: 0, delay: 0, easing: null };
  const duration = toMs(durationMatch[1], durationMatch[2]);
  rest = rest.slice(durationMatch[0].length).trim();

  let delay = 0;
  const delayMatch = rest.match(TIME);
  if (delayMatch) {
    delay = toMs(delayMatch[1], delayMatch[2]);
    rest = rest.slice(delayMatch[0].length).trim();
  }

  return { duration, delay, easing: rest || null };
}

function styleTokensToMap(node: AnimationStyleMetadata | null): ɵStyleData | null {
  if (!node) return null;
  const styles = node.styles;
  if (styles === "*") return null;
  if (Array.isArray(styles)) {
    const merged: ɵStyleData = {};
    for (const entry of styles) if (entry !== "*") Object.assign(merged, entry);
    return merged;
  }
  return styles;
}

function toKeyframe(styles: ɵStyleData, offset: number): ɵStyleDataMap {
  const keyframe: ɵStyleDataMap = new Map(Object.entries(styles));
  keyframe.set("offset", offset);
  return keyframe;
}

/**
 * Los keyframes de un `animate()`: `from` (el `style()` acumulado antes) en
 * offset 0 y el destino en offset 1; con `keyframes([...])`, un frame por paso —
 * con su `offset` o repartidos parejo si no lo traen.
 */
function toKeyframes(
  from: ɵStyleData | null,
  target: AnimationStyleMetadata | AnimationKeyframesSequenceMetadata | null,
): Array<ɵStyleDataMap> {
  if (target?.type === AnimationMetadataType.Keyframes) {
    const last = target.steps.length - 1;
    return target.steps.map((step, index) => {
      const styles = styleTokensToMap(step) ?? {};
      const offset = step.offset ?? (styles.offset != null ? Number(styles.offset) : last ? index / last : 1);
      return toKeyframe(index === 0 && from ? { ...from, ...styles } : styles, offset);
    });
  }

  const frames: Array<ɵStyleDataMap> = [];
  if (from) frames.push(toKeyframe(from, 0));
  const to = styleTokensToMap(target);
  if (to) frames.push(toKeyframe(to, 1));
  return frames;
}

/**
 * Camina los pasos de `build()` y produce los segmentos del driver. Un
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
      segments.push({ keyframes: toKeyframes(pendingFrom, animate.styles), duration, delay, easing });
      pendingFrom = null;
    }
    // group/sequence anidados, query, stagger, animateChild, animateRef → brecha (se ignoran).
  }

  // `[style({...})]` sin `animate` → aplicar el estilo de una (segmento instantáneo).
  if (pendingFrom && segments.length === 0) {
    segments.push({ keyframes: [toKeyframe(pendingFrom, 1)], duration: 0, delay: 0, easing: null });
  }

  return { segments, parallel };
}

// --- Player / factory / builder sobre el `AnimationDriver` --------------

/**
 * Orquesta los segmentos: un player del driver por segmento, en cadena
 * (`sequence`) o todos juntos (`group`). Pausa y posición se delegan en esos
 * players — funcionan en la medida en que el driver las soporte.
 */
class BrowserAnimationPlayer implements AnimationPlayer {
  readonly totalTime: number;

  private started = false;
  private finished = false;
  private paused = false;
  /** Índice de segmento → su player, a medida que el driver los crea. */
  private readonly players = new Map<number, AnimationPlayer>();
  private readonly active = new Set<AnimationPlayer>();
  /** Ventana de cada segmento dentro de `totalTime` (ms). */
  private readonly starts: number[] = [];
  private readonly spans: number[] = [];
  private readonly startBag = new ɵCallbackBag();
  private readonly doneBag = new ɵCallbackBag();
  private readonly destroyBag = new ɵCallbackBag();

  constructor(
    private readonly driver: AnimationDriver,
    private readonly element: Element,
    private readonly segments: ɵAnimationSegment[],
    private readonly parallel: boolean,
    private readonly initialDelay: number,
  ) {
    let total = 0;
    segments.forEach((seg, index) => {
      const span = this.delayOf(index) + seg.duration;
      this.starts.push(parallel ? 0 : total);
      this.spans.push(span);
      total = parallel ? Math.max(total, span) : total + span;
    });
    this.totalTime = total;
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
    if (this.started) {
      if (this.paused) {
        this.paused = false;
        for (const player of this.active) player.play();
      }
      return;
    }
    this.started = true;
    this.startBag.flush();

    const startSegment = (seg: ɵAnimationSegment, index: number): Promise<void> =>
      new Promise((resolve) => {
        const player = this.driver.animate(
          this.element,
          seg.keyframes,
          seg.duration,
          this.delayOf(index),
          seg.easing,
          [],
        );
        this.players.set(index, player);
        this.active.add(player);
        player.onDone(() => {
          this.active.delete(player);
          resolve();
        });
        player.play();
      });
    const settle = () => this.complete();

    if (this.parallel) {
      Promise.all(this.segments.map(startSegment)).then(settle, settle);
    } else {
      this.segments
        .reduce((chain, seg, index) => chain.then(() => startSegment(seg, index)), Promise.resolve())
        .then(settle, settle);
    }
  }

  finish(): void {
    for (const player of [...this.players.values()]) player.finish();
    this.complete();
  }

  pause(): void {
    if (!this.started || this.finished) return;
    this.paused = true;
    for (const player of this.active) player.pause();
  }

  setPosition(position: number): void {
    const time = position * this.totalTime;
    for (const [index, player] of this.players) {
      const span = this.spans[index];
      player.setPosition(span ? Math.min(1, Math.max(0, (time - this.starts[index]) / span)) : 1);
    }
  }

  getPosition(): number {
    if (this.finished) return 1;
    if (!this.totalTime || this.players.size === 0) return 0;
    // `sequence`: el segmento en curso; `group`: el más largo (como `AnimationGroupPlayer`).
    let current = -1;
    for (const index of this.players.keys()) {
      if (current < 0 || (this.parallel ? this.spans[index] > this.spans[current] : index > current)) current = index;
    }
    const player = this.players.get(current) as AnimationPlayer;
    return (this.starts[current] + player.getPosition() * this.spans[current]) / this.totalTime;
  }

  reset(): void {
    this.started = false;
    this.finished = false;
    this.paused = false;
    this.players.clear();
    this.active.clear();
  }
  restart(): void {
    this.reset();
    this.play();
  }
  destroy(): void {
    this.finish();
    for (const player of [...this.players.values()]) player.destroy();
    this.reset();
    this.destroyBag.flush();
  }

  private complete(): void {
    if (this.finished) return;
    this.finished = true;
    this.doneBag.flush();
  }

  /** El `delay` de `create(el, { delay })` corre el arranque: del primer segmento en `sequence`, de todos en `group`. */
  private delayOf(index: number): number {
    return this.segments[index].delay + (this.parallel || index === 0 ? this.initialDelay : 0);
  }
}

class BrowserAnimationFactory extends AnimationFactory {
  constructor(
    private readonly driver: AnimationDriver,
    private readonly segments: ɵAnimationSegment[],
    private readonly parallel: boolean,
  ) {
    super();
  }

  create(element: unknown, options?: AnimationOptions): AnimationPlayer {
    if (this.segments.length === 0) return new NoopAnimationPlayer();
    const rawDelay = options?.delay ?? 0;
    const delay = typeof rawDelay === "number" ? rawDelay : ɵparseAnimationTimings(rawDelay).duration;
    return new BrowserAnimationPlayer(this.driver, element as Element, this.segments, this.parallel, delay);
  }
}

/**
 * El `AnimationBuilder` del core: aplana la metadata y delega cada segmento en
 * el `AnimationDriver`. Lo proveen `BrowserAnimationsModule` y
 * `NoopAnimationsModule` — lo que cambia entre ambos es el driver.
 */
@Injectable()
export class BrowserAnimationBuilder extends AnimationBuilder {
  constructor(private readonly driver: AnimationDriver) {
    super();
  }

  build(animation: AnimationMetadata | AnimationMetadata[]): AnimationFactory {
    const { segments, parallel } = ɵflattenAnimationToSegments(animation);
    return new BrowserAnimationFactory(this.driver, segments, parallel);
  }
}
