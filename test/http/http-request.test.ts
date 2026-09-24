import { describe, expect, it } from "vitest";
import { HttpParams } from "@/http/http-params.ts";
import { HttpRequest } from "@/http/http-request.ts";

describe("etapa 13 — HttpRequest", () => {
  it("urlWithParams() anexa los params como query string", () => {
    const req = new HttpRequest("GET", "/api/users", null, { params: new HttpParams({ page: "2" }) });
    expect(req.urlWithParams()).toBe("/api/users?page=2");
  });

  it("urlWithParams() sin params devuelve la url tal cual", () => {
    const req = new HttpRequest("GET", "/api/users");
    expect(req.urlWithParams()).toBe("/api/users");
  });

  it("urlWithParams() con una url que ya trae '?' usa '&'", () => {
    const req = new HttpRequest("GET", "/api/users?active=true", null, { params: new HttpParams({ page: "2" }) });
    expect(req.urlWithParams()).toBe("/api/users?active=true&page=2");
  });

  it("clone() es inmutable: devuelve un HttpRequest nuevo, sin tocar el original", () => {
    const original = new HttpRequest("GET", "/api/users");
    const cloned = original.clone({ method: "POST", body: { name: "max" } });

    expect(original.method).toBe("GET");
    expect(original.body).toBeNull();
    expect(cloned.method).toBe("POST");
    expect(cloned.body).toEqual({ name: "max" });
    expect(cloned.url).toBe(original.url);
  });

  it("responseType default es 'json'", () => {
    expect(new HttpRequest("GET", "/x").responseType).toBe("json");
  });
});
