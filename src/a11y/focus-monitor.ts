import { type Observable, Subject } from "rxjs";
import { ElementRef } from "@/core/refs/element-ref.ts";

/**
 * `FocusMonitor` — mismo servicio que `@angular/cdk/a11y`. Dice **cómo** un
 * elemento recibió el foco (`keyboard`/`mouse`/`touch`/`program`) y pone las
 * clases `.cdk-*-focused`, para estilar distinto el foco de teclado.
 */

export type FocusOrigin = "touch" | "mouse" | "keyboard" | "program" | null;

const ORIGIN_CLASS: Record<Exclude<FocusOrigin, null>, string> = {
  keyboard: "cdk-keyboard-focused",
  mouse: "cdk-mouse-focused",
  touch: "cdk-touch-focused",
  program: "cdk-program-focused",
};

/** Ventana durante la cual un `keydown`/`mousedown`/`touchstart` "explica" el `focus` que sigue. */
const INTERACTION_BUFFER_MS = 650;

interface MonitoredElement {
  readonly subject: Subject<FocusOrigin>;
  readonly observable: Observable<FocusOrigin>;
  readonly checkChildren: boolean;
  readonly onFocus: (event: FocusEvent) => void;
  readonly onBlur: (event: FocusEvent) => void;
}

export class FocusMonitor {
  static readonly $name = "FocusMonitor";
  static readonly $inject = [] as const;

  private readonly elements = new Map<HTMLElement, MonitoredElement>();
  private lastInteraction: Exclude<FocusOrigin, null> | null = null;
  private lastInteractionTime = 0;
  private originToForce: FocusOrigin = null;
  private globalsAttached = false;

  private readonly markInteraction = (type: Exclude<FocusOrigin, null>) => () => {
    this.lastInteraction = type;
    this.lastInteractionTime = Date.now();
  };
  private readonly onKeyDown = this.markInteraction("keyboard");
  private readonly onMouseDown = this.markInteraction("mouse");
  private readonly onTouchStart = this.markInteraction("touch");

  /** Empieza a monitorear el elemento; el Observable emite el origen en cada foco y `null` al perderlo. */
  monitor(element: HTMLElement | ElementRef<HTMLElement>, checkChildren = false): Observable<FocusOrigin> {
    const host = element instanceof ElementRef ? element.nativeElement : element;
    const existing = this.elements.get(host);
    if (existing) return existing.observable;

    const subject = new Subject<FocusOrigin>();
    const observable = subject.asObservable();
    const onFocus = (event: FocusEvent) => {
      if (!checkChildren && event.target !== host) return;
      const origin = this.resolveOrigin();
      this.setClasses(host, origin);
      subject.next(origin);
    };
    const onBlur = (event: FocusEvent) => {
      if (!checkChildren && event.target !== host) return;
      if (checkChildren && host.contains(event.relatedTarget as Node)) return;
      this.setClasses(host, null);
      subject.next(null);
    };

    host.addEventListener("focus", onFocus, true);
    host.addEventListener("blur", onBlur, true);
    this.elements.set(host, { subject, observable, checkChildren, onFocus, onBlur });
    this.attachGlobals();
    return observable;
  }

  stopMonitoring(element: HTMLElement | ElementRef<HTMLElement>): void {
    const host = element instanceof ElementRef ? element.nativeElement : element;
    const entry = this.elements.get(host);
    if (!entry) return;
    host.removeEventListener("focus", entry.onFocus, true);
    host.removeEventListener("blur", entry.onBlur, true);
    this.setClasses(host, null);
    entry.subject.complete();
    this.elements.delete(host);
    if (this.elements.size === 0) this.detachGlobals();
  }

  /** Enfoca `element` marcando el origen (`origin`), como `focusVia` de CDK. */
  focusVia(element: HTMLElement | ElementRef<HTMLElement>, origin: FocusOrigin, options?: FocusOptions): void {
    const host = element instanceof ElementRef ? element.nativeElement : element;
    this.originToForce = origin;
    host.focus(options);
    this.originToForce = null;
  }

  ngOnDestroy(): void {
    for (const host of [...this.elements.keys()]) this.stopMonitoring(host);
    this.detachGlobals();
  }

  private resolveOrigin(): FocusOrigin {
    if (this.originToForce !== null) return this.originToForce;
    if (this.lastInteraction && Date.now() - this.lastInteractionTime < INTERACTION_BUFFER_MS) {
      return this.lastInteraction;
    }
    return "program";
  }

  private setClasses(host: HTMLElement, origin: FocusOrigin): void {
    for (const cls of Object.values(ORIGIN_CLASS)) host.classList.remove(cls);
    host.classList.toggle("cdk-focused", origin !== null);
    if (origin) host.classList.add(ORIGIN_CLASS[origin]);
  }

  private attachGlobals(): void {
    if (this.globalsAttached) return;
    document.addEventListener("keydown", this.onKeyDown, true);
    document.addEventListener("mousedown", this.onMouseDown, true);
    document.addEventListener("touchstart", this.onTouchStart, true);
    this.globalsAttached = true;
  }

  private detachGlobals(): void {
    if (!this.globalsAttached) return;
    document.removeEventListener("keydown", this.onKeyDown, true);
    document.removeEventListener("mousedown", this.onMouseDown, true);
    document.removeEventListener("touchstart", this.onTouchStart, true);
    this.globalsAttached = false;
  }
}
