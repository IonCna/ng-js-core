import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveAnnouncer } from "@/cdk/a11y/index.ts";

const liveEl = () => document.querySelector(".cdk-live-announcer-element");

describe("etapa 18 (a11y) — LiveAnnouncer", () => {
  let announcer: LiveAnnouncer;

  beforeEach(() => {
    vi.useFakeTimers();
    announcer = new LiveAnnouncer();
  });

  afterEach(() => {
    announcer.ngOnDestroy();
    vi.useRealTimers();
  });

  it("crea una región aria-live oculta y escribe el mensaje tras el delay", async () => {
    const done = announcer.announce("Guardado");
    // Antes del delay: región creada, sin texto todavía (fuerza el re-anuncio).
    expect(liveEl()).not.toBeNull();
    expect(liveEl()?.getAttribute("aria-live")).toBe("polite");
    expect(liveEl()?.textContent).toBe("");

    vi.advanceTimersByTime(100);
    await done;
    expect(liveEl()?.textContent).toBe("Guardado");
  });

  it("politeness explícito", async () => {
    const done = announcer.announce("Error", "assertive");
    vi.advanceTimersByTime(100);
    await done;
    expect(liveEl()?.getAttribute("aria-live")).toBe("assertive");
  });

  it("politeness 'off' → no anuncia y resuelve al toque", async () => {
    await announcer.announce("nada", "off");
    expect(liveEl()).toBeNull();
  });

  it("segundo argumento numérico = duración: se limpia sola", async () => {
    const done = announcer.announce("temporal", 2000);
    vi.advanceTimersByTime(100);
    await done;
    expect(liveEl()?.textContent).toBe("temporal");
    vi.advanceTimersByTime(2000);
    expect(liveEl()?.textContent).toBe("");
  });

  it("clear() vacía el mensaje", async () => {
    const done = announcer.announce("hola");
    vi.advanceTimersByTime(100);
    await done;
    announcer.clear();
    expect(liveEl()?.textContent).toBe("");
  });

  it("ngOnDestroy() quita la región del DOM", async () => {
    const done = announcer.announce("hola");
    vi.advanceTimersByTime(100);
    await done;
    announcer.ngOnDestroy();
    expect(liveEl()).toBeNull();
  });

  it("un announce nuevo pisa al anterior (limpia el timeout pendiente)", async () => {
    announcer.announce("primero");
    const second = announcer.announce("segundo");
    vi.advanceTimersByTime(100);
    await second;
    expect(liveEl()?.textContent).toBe("segundo");
  });

  it("respeta LiveAnnouncerDefaultOptions", async () => {
    const withDefaults = new LiveAnnouncer({ politeness: "assertive" });
    const done = withDefaults.announce("x");
    vi.advanceTimersByTime(100);
    await done;
    expect(liveEl()?.getAttribute("aria-live")).toBe("assertive");
    withDefaults.ngOnDestroy();
  });
});
