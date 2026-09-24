import type { AriaLivePoliteness, LiveAnnouncer } from "@/cdk/a11y/live-announcer.ts";
import type { OnDestroy, OnInit } from "@/core/lifecycle/interfaces.ts";
import { Directive } from "@/core/metadata/directive.ts";
import { Input } from "@/core/metadata/input.ts";
import type { ElementRef } from "@/core/refs/element-ref.ts";

/**
 * `[cdkAriaLive]` — misma directiva que `@angular/cdk/a11y`. Observa el texto del host con un `MutationObserver` y
 * lo pasa a `LiveAnnouncer` cuando cambia. `cdk-aria-live="assertive"` y `cdk-aria-live-duration="2000"` son texto
 * (binding `@`), como un atributo estático de Angular.
 */
@Directive({ selector: "[cdkAriaLive]", exportAs: "cdkAriaLive" })
export class CdkAriaLive implements OnInit, OnDestroy {
  @Input({ binding: "@" }) cdkAriaLive?: string;
  @Input({ binding: "@" }) cdkAriaLiveDuration?: string;

  private observer?: MutationObserver;
  private lastText = "";

  constructor(
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly live: LiveAnnouncer,
  ) {}

  ngOnInit(): void {
    const host = this.elementRef.nativeElement;
    this.lastText = (host.textContent ?? "").trim();
    this.observer = new MutationObserver(() => this.maybeAnnounce());
    this.observer.observe(host, { characterData: true, childList: true, subtree: true });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private get politeness(): AriaLivePoliteness {
    const value = this.cdkAriaLive || "polite";
    return value === "off" || value === "assertive" ? value : "polite";
  }

  private get duration(): number | undefined {
    const parsed = this.cdkAriaLiveDuration ? Number.parseInt(this.cdkAriaLiveDuration, 10) : Number.NaN;
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
}
