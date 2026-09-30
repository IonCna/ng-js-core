import { describe, expect, it } from "vitest";
import { type CurrentUrl, UrlCommands } from "@/router/url-commands.ts";

const at = (path: string, query: CurrentUrl["query"] = {}, fragment: string | null = null): CurrentUrl => ({
  path,
  query,
  fragment,
});
const route = { snapshot: {} };

describe("UrlCommands (router.navigate como Angular)", () => {
  it("absoluto con '/'; sin relativeTo, relativo a la raíz", () => {
    expect(UrlCommands.apply(["/users", 5], undefined, at("/admin/x"))).toBe("/users/5");
    expect(UrlCommands.apply(["users", 5, "edit"], undefined, at("/admin/x"))).toBe("/users/5/edit");
  });

  it("con relativeTo: parte de la URL de la ruta; '..' sube, '.' y '' no cambian", () => {
    expect(UrlCommands.apply(["edit"], { relativeTo: route }, at("/users/5"))).toBe("/users/5/edit");
    expect(UrlCommands.apply(["../6"], { relativeTo: route }, at("/users/5"))).toBe("/users/6");
    expect(UrlCommands.apply(["..", "..", "home"], { relativeTo: route }, at("/users/5"))).toBe("/home");
    expect(UrlCommands.apply(["./detail", ""], { relativeTo: route }, at("/users/5?tab=a#x"))).toBe("/users/5/detail");
    expect(() => UrlCommands.apply(["../../.."], { relativeTo: route }, at("/users/5"))).toThrow(/más allá de la raíz/);
  });

  it("queryParams con queryParamsHandling (merge/preserve), null saca; arrays repiten la clave", () => {
    const current = at("/list", { page: "2", sort: "name" });
    expect(UrlCommands.apply(["/list"], { queryParams: { page: 3 } }, current)).toBe("/list?page=3");
    expect(
      UrlCommands.apply(["/list"], { queryParams: { page: 3, sort: null }, queryParamsHandling: "merge" }, current),
    ).toBe("/list?page=3");
    expect(UrlCommands.apply(["/other"], { queryParams: { x: 1 }, queryParamsHandling: "preserve" }, current)).toBe(
      "/other?page=2&sort=name",
    );
    expect(UrlCommands.apply(["/list"], { queryParams: { tag: ["a", "b c"] } }, current)).toBe("/list?tag=a&tag=b%20c");
  });

  it("fragment, o el actual con preserveFragment", () => {
    expect(UrlCommands.apply(["/doc"], { fragment: "top" }, at("/x", {}, "old"))).toBe("/doc#top");
    expect(UrlCommands.apply(["/doc"], { preserveFragment: true }, at("/x", {}, "old"))).toBe("/doc#old");
  });

  it("parámetros de matriz: error claro (UI-Router no los separa del segmento)", () => {
    expect(() => UrlCommands.apply(["/users", { id: 5 }], undefined, at("/"))).toThrow(/parámetros de matriz/);
  });
});
