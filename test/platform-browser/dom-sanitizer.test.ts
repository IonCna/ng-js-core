import angular from "angular";
import { describe, expect, it } from "vitest";
import { DomSanitizer, SecurityContext } from "@/platform-browser/index.ts";
import { PlatformBrowserModule } from "@/runtime/platform-browser/index.ts";

function boot(): DomSanitizer {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const injector = angular.bootstrap(host, [PlatformBrowserModule.name], { strictDi: false });
  return injector.get<DomSanitizer>(DomSanitizer.$name);
}

describe("etapa 14 — platform-browser: DomSanitizer", () => {
  it("sanitize(HTML) saca scripts y handlers, deja el markup permitido", () => {
    const s = boot();
    const out = s.sanitize(
      SecurityContext.HTML,
      '<p onclick="steal()">hola <b>mundo</b><script>alert(1)</script></p>',
    );
    expect(out).toBe("<p>hola <b>mundo</b></p>");
  });

  it("sanitize(HTML) strippea aria-* / data-* (como Angular)", () => {
    const s = boot();
    expect(s.sanitize(SecurityContext.HTML, '<div aria-label="x" data-y="z" class="ok">t</div>')).toBe(
      '<div class="ok">t</div>',
    );
  });

  it("sanitize(HTML) neutraliza javascript: en href", () => {
    const s = boot();
    expect(s.sanitize(SecurityContext.HTML, '<a href="javascript:alert(1)">x</a>')).toBe(
      '<a href="unsafe:javascript:alert(1)">x</a>',
    );
  });

  it("bypassSecurityTrustHtml pasa el HTML entero por sanitize(HTML)", () => {
    const s = boot();
    const trusted = s.bypassSecurityTrustHtml('<script>ok()</script><b>x</b>');
    expect(s.sanitize(SecurityContext.HTML, trusted)).toBe("<script>ok()</script><b>x</b>");
  });

  it("sanitize(URL) bloquea javascript:, deja http/mailto/relativo", () => {
    const s = boot();
    expect(s.sanitize(SecurityContext.URL, "javascript:alert(1)")).toBe("unsafe:javascript:alert(1)");
    expect(s.sanitize(SecurityContext.URL, "https://x.test/a")).toBe("https://x.test/a");
    expect(s.sanitize(SecurityContext.URL, "mailto:a@b.c")).toBe("mailto:a@b.c");
    expect(s.sanitize(SecurityContext.URL, "/local")).toBe("/local");
  });

  it("sanitize(NONE) passthrough; sanitize(STYLE) passthrough (Angular v10+)", () => {
    const s = boot();
    expect(s.sanitize(SecurityContext.NONE, "<x>")).toBe("<x>");
    expect(s.sanitize(SecurityContext.STYLE, "width: expression(alert(1))")).toBe(
      "width: expression(alert(1))",
    );
  });

  it("sanitize(SCRIPT | RESOURCE_URL, string) tira; solo aceptan bypasseados", () => {
    const s = boot();
    expect(() => s.sanitize(SecurityContext.SCRIPT, "doThing()")).toThrow(/script context/);
    expect(() => s.sanitize(SecurityContext.RESOURCE_URL, "/x.js")).toThrow(/resource URL/);
    expect(s.sanitize(SecurityContext.RESOURCE_URL, s.bypassSecurityTrustResourceUrl("/x.js"))).toBe("/x.js");
  });

  it("pedir un tipo con un Safe* de otro tipo tira; ResourceUrl vale como Url", () => {
    const s = boot();
    expect(() => s.sanitize(SecurityContext.HTML, s.bypassSecurityTrustUrl("x"))).toThrow(/safe HTML/);
    expect(s.sanitize(SecurityContext.URL, s.bypassSecurityTrustResourceUrl("/ok"))).toBe("/ok");
  });

  it("sanitize(*, null) → null", () => {
    const s = boot();
    expect(s.sanitize(SecurityContext.HTML, null)).toBeNull();
  });
});
