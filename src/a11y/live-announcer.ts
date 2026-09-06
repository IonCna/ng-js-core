import { InjectionToken } from "@/core/di/injection-token.ts";

/**
 * `LiveAnnouncer` — mismo servicio que `@angular/cdk/a11y`. Lee un mensaje a los
 * lectores de pantalla vía una región `aria-live` oculta, sin mover el foco ni
 * cambiar nada visible ("Guardado", "3 resultados", …).
 *
 * El truco del delay de 100ms + limpieza previa hace que el lector re-anuncie
 * aunque el mensaje sea idéntico al anterior.
 */

export type AriaLivePoliteness = "off" | "polite" | "assertive";

export interface LiveAnnouncerDefaultOptions {
  politeness?: AriaLivePoliteness;
  duration?: number;
}

/** Provee `{ politeness?, duration? }` por defecto para `LiveAnnouncer` — igual que en CDK. */
export const LIVE_ANNOUNCER_DEFAULT_OPTIONS = new InjectionToken<LiveAnnouncerDefaultOptions>(
  "LIVE_ANNOUNCER_DEFAULT_OPTIONS",
);

const LIVE_ELEMENT_CLASS = "cdk-live-announcer-element";
const ANNOUNCE_DELAY = 100;

/** "Visualmente oculto" inline (mismo efecto que `.cdk-visually-hidden`). */
function hideVisually(el: HTMLElement): void {
  Object.assign(el.style, {
    position: "absolute",
    width: "1px",
    height: "1px",
    margin: "-1px",
    padding: "0",
    border: "0",
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    clipPath: "inset(100%)",
    whiteSpace: "nowrap",
  });
}

export class LiveAnnouncer {
  static readonly $name = "LiveAnnouncer";
  static readonly $inject = [LIVE_ANNOUNCER_DEFAULT_OPTIONS.toString()] as const;

  private liveElement: HTMLElement | null = null;
  private previousTimeout?: ReturnType<typeof setTimeout>;
  private currentResolve?: () => void;

  constructor(private readonly defaultOptions: LiveAnnouncerDefaultOptions = {}) {}

  announce(message: string): Promise<void>;
  announce(message: string, politeness: AriaLivePoliteness): Promise<void>;
  announce(message: string, duration: number): Promise<void>;
  announce(message: string, politeness: AriaLivePoliteness, duration: number): Promise<void>;
  announce(message: string, politeness?: AriaLivePoliteness | number, duration?: number): Promise<void> {
    const defaults = this.defaultOptions;
    let resolvedPoliteness: AriaLivePoliteness | undefined;
    let resolvedDuration: number | undefined;

    if (typeof politeness === "number") {
      resolvedDuration = politeness;
      resolvedPoliteness = defaults.politeness;
    } else {
      resolvedPoliteness = politeness ?? defaults.politeness;
      resolvedDuration = duration ?? defaults.duration;
    }

    this.clear();
    clearTimeout(this.previousTimeout);
    this.currentResolve?.();
    this.currentResolve = undefined;

    resolvedPoliteness ??= "polite";
    if (resolvedPoliteness === "off") {
      return Promise.resolve();
    }

    const el = this.ensureLiveElement();
    el.setAttribute("aria-live", resolvedPoliteness);

    return new Promise<void>((resolve) => {
      this.currentResolve = resolve;
      this.previousTimeout = setTimeout(() => {
        el.textContent = message;
        this.currentResolve?.();
        this.currentResolve = undefined;
        if (typeof resolvedDuration === "number") {
          this.previousTimeout = setTimeout(() => this.clear(), resolvedDuration);
        }
      }, ANNOUNCE_DELAY);
    });
  }

  /** Vacía el mensaje actual. */
  clear(): void {
    if (this.liveElement) this.liveElement.textContent = "";
  }

  /** Quita la región del DOM y cancela lo pendiente. */
  ngOnDestroy(): void {
    clearTimeout(this.previousTimeout);
    this.liveElement?.remove();
    this.liveElement = null;
    this.currentResolve?.();
    this.currentResolve = undefined;
  }

  private ensureLiveElement(): HTMLElement {
    if (this.liveElement) return this.liveElement;

    for (const stale of document.querySelectorAll(`.${LIVE_ELEMENT_CLASS}`)) {
      stale.remove();
    }

    const el = document.createElement("div");
    el.classList.add(LIVE_ELEMENT_CLASS);
    el.setAttribute("aria-atomic", "true");
    el.setAttribute("aria-live", "polite");
    hideVisually(el);
    document.body.appendChild(el);
    this.liveElement = el;
    return el;
  }
}
