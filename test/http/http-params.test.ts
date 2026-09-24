import { describe, expect, it } from "vitest";
import { HttpParams } from "@/http/http-params.ts";

describe("etapa 13 — HttpParams", () => {
  it("se construye desde un objeto y serializa a query string", () => {
    const params = new HttpParams({ a: "1", b: 2, c: true });
    expect(params.toString()).toBe("a=1&b=2&c=true");
  });

  it("se construye desde un query string crudo (con o sin '?')", () => {
    expect(new HttpParams("a=1&b=2").get("a")).toBe("1");
    expect(new HttpParams("?a=1&b=2").get("b")).toBe("2");
  });

  it("set/append/delete devuelven una copia — no mutan el original", () => {
    const original = new HttpParams({ a: "1" });
    const withB = original.set("b", "2");

    expect(original.has("b")).toBe(false);
    expect(withB.toString()).toBe("a=1&b=2");

    const appended = withB.append("a", "3");
    expect(appended.getAll("a")).toEqual(["1", "3"]);
    expect(withB.getAll("a")).toEqual(["1"]);

    const deleted = appended.delete("b");
    expect(deleted.has("b")).toBe(false);
    expect(appended.has("b")).toBe(true);
  });

  it("valores especiales quedan url-encoded", () => {
    const params = new HttpParams({ q: "a b&c" });
    expect(params.toString()).toBe("q=a%20b%26c");
  });
});
