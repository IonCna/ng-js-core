import type { IRootScopeService } from "angular";
import { Injectable } from "@/core/di/injectable.ts";
import { EventEmitter } from "@/core/event-emitter.ts";

/** El contador que leen los patches del compilador (`ZonePatchesRuntime`): > 0 = afuera de Angular. */
const OUTSIDE_ANGULAR_GLOBAL = "ɵngjsOutsideAngular";

/**
 * Fachada compatible con `NgZone`. No crea ni usa un Zone real: conecta la
 * sintaxis Angular con el digest de AngularJS y deja que el compiler cubra el
 * trabajo async global. Se provee sola en la raíz; los errores de `runGuarded`
 * van a `$exceptionHandler` (y de ahí al `ErrorHandler` de la app).
 */
@Injectable({
  providedIn: "root",
  useFactory: ($rootScope: IRootScopeService, $exceptionHandler: (error: unknown) => void) =>
    new NgZoneImpl($rootScope, $exceptionHandler),
  deps: ["$rootScope", "$exceptionHandler"],
})
export abstract class NgZone {
  readonly onUnstable = new EventEmitter<void>();
  readonly onMicrotaskEmpty = new EventEmitter<void>();
  readonly onStable = new EventEmitter<void>();
  readonly onError = new EventEmitter<unknown>();

  protected constructor(protected readonly $rootScope: IRootScopeService) {}

  get isStable(): boolean {
    return !this.$rootScope.$$phase;
  }

  get hasPendingMicrotasks(): boolean {
    return false;
  }

  get hasPendingMacrotasks(): boolean {
    return false;
  }

  abstract run<T>(fn: () => T): T;
  abstract runGuarded<T>(fn: () => T): T | undefined;
  abstract runTask<T>(fn: () => T): T;
  abstract runOutsideAngular<T>(fn: () => T): T;

  /** Afuera de un `runOutsideAngular`: lo que se programe dispara digest. */
  static isInAngularZone(): boolean {
    return !(((globalThis as Record<string, unknown>)[OUTSIDE_ANGULAR_GLOBAL] as number | undefined) ?? 0);
  }

  static assertInAngularZone(): void {
    if (!NgZone.isInAngularZone()) throw new Error("Se esperaba estar dentro de la zona de Angular.");
  }

  static assertNotInAngularZone(): void {
    if (NgZone.isInAngularZone()) throw new Error("Se esperaba estar fuera de la zona de Angular.");
  }
}

export class NgZoneImpl extends NgZone {
  private running = 0;
  private stableScheduled = false;

  constructor(
    $rootScope: IRootScopeService,
    private readonly reportError: (error: unknown) => void = () => {},
  ) {
    super($rootScope);
    // Un digest de AngularJS es un "turno" de la zona de Angular: al terminar cada uno, `onMicrotaskEmpty` y
    // `onStable` (lo esperan `PopupService`, el reposicionado de popper, …). Sin esto solo salían tras un `run()`.
    $rootScope.$watch(() => this.scheduleStable());
  }

  run<T>(fn: () => T): T {
    this.enter();
    try {
      return fn();
    } catch (error) {
      this.onError.emit(error);
      throw error;
    } finally {
      this.leave();
    }
  }

  /** Como Angular: el error no se propaga — va a `onError` y al `ErrorHandler` (vía `$exceptionHandler`). */
  runGuarded<T>(fn: () => T): T | undefined {
    try {
      return this.run(fn);
    } catch (error) {
      this.reportError(error);
      return undefined;
    }
  }

  runTask<T>(fn: () => T): T {
    return this.run(fn);
  }

  /**
   * Lo que `fn` programe (timers, listeners, `.then`) no dispara digest al correr: los patches del compilador lo
   * deciden al programarlo, mirando este contador (como la zona de Angular).
   */
  runOutsideAngular<T>(fn: () => T): T {
    const globals = globalThis as Record<string, unknown>;
    globals[OUTSIDE_ANGULAR_GLOBAL] = ((globals[OUTSIDE_ANGULAR_GLOBAL] as number | undefined) ?? 0) + 1;
    try {
      return fn();
    } finally {
      globals[OUTSIDE_ANGULAR_GLOBAL] = (globals[OUTSIDE_ANGULAR_GLOBAL] as number) - 1;
    }
  }

  private enter(): void {
    if (this.running++ === 0) this.onUnstable.emit();
  }

  private leave(): void {
    if (--this.running !== 0) return;
    // Lo que corrió en la zona termina con un digest (que emite `onStable` al terminar): si ya hay uno en curso,
    // basta con agendar la notificación; si no, `$evalAsync()` agenda uno.
    if (this.$rootScope.$$phase) this.scheduleStable();
    else this.$rootScope.$evalAsync(() => undefined);
  }

  /** `onMicrotaskEmpty` + `onStable` una vez, al terminar el digest en curso. */
  private scheduleStable(): void {
    if (this.stableScheduled) return;
    this.stableScheduled = true;
    (this.$rootScope as IRootScopeService & { $$postDigest(fn: () => void): void }).$$postDigest(() => {
      this.stableScheduled = false;
      this.onMicrotaskEmpty.emit();
      // Como Angular (`checkStable`): `onStable` sale fuera de la zona — lo que programe un suscriptor (el `update()`
      // de popper agenda un `.then`) no dispara otro digest, que volvería a emitir `onStable` sin fin.
      this.runOutsideAngular(() => this.onStable.emit());
    });
  }
}
