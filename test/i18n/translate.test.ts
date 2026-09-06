import type angular from "angular";
import { describe, expect, it, vi } from "vitest";
import { LOCALE_ID, TranslateService, TranslateServiceImpl } from "@/i18n/index.ts";

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

function interpolate(raw: string, params?: Record<string, unknown>): string {
  if (!params) return raw;
  return raw.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => String(params[key] ?? ""));
}

/** `$translate` de mentira: tablas por idioma, `use()` sync/async, key desconocida → la key. */
function fakeTranslate(tables: Record<string, Record<string, string>>, initial = "en") {
  let lang = initial;
  const lookup = (key: string, params?: Record<string, unknown>) => {
    const raw = tables[lang]?.[key];
    return raw === undefined ? key : interpolate(raw, params);
  };
  const fn = ((key: string, params?: Record<string, unknown>) => Promise.resolve(lookup(key, params))) as {
    (key: string, params?: Record<string, unknown>): Promise<string>;
    instant(key: string, params?: Record<string, unknown>): string;
    use(next?: string): string | Promise<string>;
  };
  fn.instant = lookup;
  fn.use = (next?: string) => {
    if (next === undefined) return lang;
    lang = next;
    return Promise.resolve(lang);
  };
  return fn;
}

/** `$rootScope` de mentira: solo `$on` / `$emit`. */
function fakeRootScope() {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const scope = {
    $on(name: string, fn: (...args: unknown[]) => void) {
      const arr = listeners.get(name) ?? [];
      arr.push(fn);
      listeners.set(name, arr);
      return () => {
        const current = listeners.get(name) ?? [];
        const i = current.indexOf(fn);
        if (i >= 0) current.splice(i, 1);
      };
    },
    $emit(name: string, ...args: unknown[]) {
      for (const fn of [...(listeners.get(name) ?? [])]) fn({ name }, ...args);
    },
  };
  return scope as unknown as angular.IRootScopeService & { $emit(name: string, ...args: unknown[]): void };
}

function build(tables: Record<string, Record<string, string>>, initial = "en") {
  const $translate = fakeTranslate(tables, initial);
  const $rootScope = fakeRootScope();
  const service = new TranslateServiceImpl($translate as never, $rootScope);
  return { service, $rootScope };
}

const TABLES = {
  en: { HELLO: "Hello", GREET: "Hi {{ name }}" },
  es: { HELLO: "Hola", GREET: "Hola {{ name }}" },
};

describe("etapa 18 — TranslateService", () => {
  it("es un TranslateService", () => {
    const { service } = build(TABLES);
    expect(service).toBeInstanceOf(TranslateService);
  });

  it("instant() delega en $translate.instant y cae a la key si no existe", () => {
    const { service } = build(TABLES);
    expect(service.instant("HELLO")).toBe("Hello");
    expect(service.instant("NOPE")).toBe("NOPE");
  });

  it("instant() interpola params", () => {
    const { service } = build(TABLES);
    expect(service.instant("GREET", { name: "Max" })).toBe("Hi Max");
  });

  it("get() emite async y completa", async () => {
    const { service } = build(TABLES);
    const next = vi.fn();
    const complete = vi.fn();
    service.get("HELLO").subscribe({ next, complete });
    await flushMicrotasks();
    expect(next).toHaveBeenCalledWith("Hello");
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("currentLang refleja $translate.use(); use(lang) lo cambia", async () => {
    const { service } = build(TABLES);
    expect(service.currentLang).toBe("en");
    await service.use("es");
    expect(service.currentLang).toBe("es");
    expect(service.instant("HELLO")).toBe("Hola");
  });

  it("onLangChange emite { lang } en $translateChangeSuccess", () => {
    const { service, $rootScope } = build(TABLES);
    const seen: Array<{ lang: string }> = [];
    service.onLangChange.subscribe((e) => seen.push(e));
    $rootScope.$emit("$translateChangeSuccess", { language: "es" });
    expect(seen).toEqual([{ lang: "es" }]);
  });

  it("stream() re-emite en cada cambio de idioma", async () => {
    const { service, $rootScope } = build(TABLES);
    const seen: string[] = [];
    service.stream("HELLO").subscribe((v) => seen.push(v));
    await flushMicrotasks();

    // el fake `use` no dispara el evento — lo emitimos como hace angular-translate
    await service.use("es");
    $rootScope.$emit("$translateChangeSuccess", { language: "es" });
    await flushMicrotasks();

    expect(seen).toEqual(["Hello", "Hola"]);
  });

  it("$destroy completa onLangChange y desengancha el listener", () => {
    const { service, $rootScope } = build(TABLES);
    const complete = vi.fn();
    service.onLangChange.subscribe({ complete });
    $rootScope.$emit("$destroy");
    expect(complete).toHaveBeenCalledTimes(1);

    const after = vi.fn();
    service.onLangChange.subscribe({ next: after, complete: () => {} });
    $rootScope.$emit("$translateChangeSuccess", { language: "es" });
    expect(after).not.toHaveBeenCalled();
  });
});

describe("etapa 18 — LOCALE_ID", () => {
  it("es un InjectionToken con descripción estable", () => {
    expect(String(LOCALE_ID)).toMatch(/^LOCALE_ID-\d+$/);
  });
});
