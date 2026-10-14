/**
 * Contrato de player de `@angular/animations` + el player no-op. Vive aparte del
 * builder porque también lo usan los drivers (`ngjs-core/animations/browser`).
 */

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

export class ɵCallbackBag {
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
 * microtask y termina. Lo devuelve `ɵNoopAnimationDriver` y también el builder
 * cuando la metadata no produce ningún segmento.
 */
export class NoopAnimationPlayer implements AnimationPlayer {
  private started = false;
  private finished = false;
  private readonly startBag = new ɵCallbackBag();
  private readonly doneBag = new ɵCallbackBag();
  private readonly destroyBag = new ɵCallbackBag();

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
