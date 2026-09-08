/**
 * Traduce el nombre de evento de un `@HostListener("keydown.shift.tab")` al par
 * `{ domEventName, matches(event) }`. Mismo álgebra que el `KeyEventsPlugin` de
 * Angular:
 *
 *   `<evento>.<modificador...>.<tecla>`
 *
 * — los modificadores (`alt` / `control` / `meta` / `shift`) van en cualquier
 * orden, y `tecla` se compara contra `KeyboardEvent.key` en minúsculas, con
 * `" "` → `"space"` y `"."` → `"dot"` (igual que Angular). Sin sufijo de tecla
 * (`@HostListener("click")`) el matcher siempre da `true` y el evento se
 * escucha tal cual.
 */
const MODIFIER_KEYS = ["alt", "control", "meta", "shift"] as const;
type ModifierKey = (typeof MODIFIER_KEYS)[number];

const MODIFIER_GETTERS: Record<ModifierKey, (event: KeyboardEvent) => boolean> = {
  alt: (event) => event.altKey,
  control: (event) => event.ctrlKey,
  meta: (event) => event.metaKey,
  shift: (event) => event.shiftKey,
};

/** Sentinela para una spec sintácticamente inválida — nunca matchea. */
const INVALID = "\0invalid";

export class HostListenerKeySpec {
  /** El evento DOM real a pasarle a `addEventListener` (`"keydown"`, `"click"`, …). */
  readonly domEventName: string;

  /**
   * `null` → sin filtro de tecla (listener de evento a secas).
   * `INVALID` → sobraron segmentos que no son modificadores → nunca matchea.
   * string → `<modificador.>*<tecla>` normalizado a comparar contra el evento.
   */
  private readonly fullKey: string | null;

  constructor(eventName: string) {
    const parts = eventName.toLowerCase().split(".");
    this.domEventName = parts.shift() || eventName.toLowerCase();

    if (parts.length === 0) {
      this.fullKey = null;
      return;
    }

    const key = parts.pop() ?? "";
    let fullKey = "";
    for (const modifier of MODIFIER_KEYS) {
      const index = parts.indexOf(modifier);
      if (index > -1) {
        parts.splice(index, 1);
        fullKey += `${modifier}.`;
      }
    }
    fullKey += key;

    this.fullKey = parts.length === 0 ? fullKey : INVALID;
  }

  /** `true` si no hay sufijo de tecla — el evento se engancha sin condición. */
  get isPlainEvent(): boolean {
    return this.fullKey === null;
  }

  matches(event: Event): boolean {
    if (this.fullKey === null) return true;
    if (this.fullKey === INVALID) return false;
    if (typeof (event as KeyboardEvent).key !== "string") return false;
    return this.buildFullKey(event as KeyboardEvent) === this.fullKey;
  }

  private buildFullKey(event: KeyboardEvent): string {
    let key = event.key.toLowerCase();
    if (key === " ") key = "space";
    else if (key === ".") key = "dot";

    let fullKey = "";
    for (const modifier of MODIFIER_KEYS) {
      if (modifier === key) continue;
      if (MODIFIER_GETTERS[modifier](event)) fullKey += `${modifier}.`;
    }
    return fullKey + key;
  }
}
