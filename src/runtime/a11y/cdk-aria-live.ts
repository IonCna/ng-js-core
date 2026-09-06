import type { IAttributes, IDirective } from "angular";
import { type AriaLivePoliteness, LiveAnnouncer } from "@/a11y/live-announcer.ts";
import { ElementRef } from "@/core/refs/element-ref.ts";

/**
 * `[cdkAriaLive]` — misma directiva que `@angular/cdk/a11y`. Observa el texto del
 * host con un `MutationObserver` y lo pasa a `LiveAnnouncer` cuando cambia.
 * `cdkAriaLive="assertive"` y `cdkAriaLiveDuration="2000"` opcionales.
 */
export class CdkAriaLive {
  static readonly $inject = [ElementRef.$name, "$attrs", LiveAnnouncer.$name] as const;

  private observer?: MutationObserver;
  private lastText = "";

  constructor(
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly $attrs: IAttributes,
    private readonly live: LiveAnnouncer,
  ) {}

  $onInit(): void {
    const host = this.elementRef.nativeElement;
    this.lastText = (host.textContent ?? "").trim();
    this.observer = new MutationObserver(() => this.maybeAnnounce());
    this.observer.observe(host, { characterData: true, childList: true, subtree: true });
  }

  $onDestroy(): void {
    this.observer?.disconnect();
  }

  private get politeness(): AriaLivePoliteness {
    const value = (this.$attrs.cdkAriaLive as string) || "polite";
    return value === "off" || value === "assertive" ? value : "polite";
  }

  private get duration(): number | undefined {
    const raw = this.$attrs.cdkAriaLiveDuration as string | undefined;
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  private maybeAnnounce(): void {
    const text = (this.elementRef.nativeElement.textContent ?? "").trim();
    if (!text || text === this.lastText) return;
    this.lastText = text;

    const politeness = this.politeness;
    if (politeness === "off") return;
    const duration = this.duration;
    void (duration === undefined
      ? this.live.announce(text, politeness)
      : this.live.announce(text, politeness, duration));
  }

  static $factory(): IDirective {
    return { restrict: "A", controller: CdkAriaLive };
  }
}
