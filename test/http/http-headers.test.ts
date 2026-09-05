import { describe, expect, it } from "vitest";
import { HttpHeaders } from "@/http/http-headers.ts";

describe("etapa 13 — HttpHeaders", () => {
  it("se construye desde un objeto, case-insensitive", () => {
    const headers = new HttpHeaders({ "Content-Type": "application/json" });
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("CONTENT-TYPE")).toBe("application/json");
  });

  it("se construye desde un string crudo tipo respuesta HTTP", () => {
    const headers = new HttpHeaders("Content-Type: text/html\nX-Custom: abc\n");
    expect(headers.get("content-type")).toBe("text/html");
    expect(headers.get("x-custom")).toBe("abc");
  });

  it("set/append/delete devuelven una copia — no mutan el original", () => {
    const original = new HttpHeaders({ a: "1" });
    const withB = original.set("b", "2");

    expect(original.has("b")).toBe(false);
    expect(withB.get("a")).toBe("1");
    expect(withB.get("b")).toBe("2");

    const appended = withB.append("a", "3");
    expect(appended.getAll("a")).toEqual(["1", "3"]);
    expect(withB.getAll("a")).toEqual(["1"]); // sin mutar

    const deleted = appended.delete("a");
    expect(deleted.has("a")).toBe(false);
    expect(appended.has("a")).toBe(true); // sin mutar
  });

  it("toObject() aplana valores múltiples con coma", () => {
    const headers = new HttpHeaders({ a: "1" }).append("a", "2");
    expect(headers.toObject()).toEqual({ a: "1, 2" });
  });

  it("get()/getAll()/has() de una clave inexistente dan null/false", () => {
    const headers = new HttpHeaders();
    expect(headers.get("x")).toBeNull();
    expect(headers.getAll("x")).toBeNull();
    expect(headers.has("x")).toBe(false);
  });
});
