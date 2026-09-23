import "reflect-metadata";
import "zone.js";
import type angular from "angular";
import { afterEach, describe, expect, it } from "vitest";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { Routes } from "@/router/index.ts";
import { Router, RouterModule, TitleStrategy } from "@/router/index.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootstrapApplication } from "@/runtime/index.ts";

@Component({ selector: "tts-root", template: "<ui-view></ui-view>" })
class TtsRoot {}
@Component({ selector: "tts-a", template: "<h1>a</h1>" })
class PageA {}
@Component({ selector: "tts-b", template: "<h1>b</h1>" })
class PageB {}
@Component({ selector: "tts-d", template: "<h1>d</h1>" })
class PageD {}

const applied: (string | undefined)[] = [];

class SuffixTitleStrategy extends TitleStrategy {
  updateTitle(title: string | undefined): void {
    applied.push(title);
    document.title = title === undefined ? "Mi App" : `${title} · Mi App`;
  }
}

const routes: Routes = [
  { path: "a", component: PageA, title: "A" },
  { path: "b", component: PageB },
  // `title` como ResolveFn que lee `data` — antes recibía `{}` acá (mismatch con ActivatedRoute.title).
  { path: "d/:id", component: PageD, title: (s) => `D/${s.data.section}/${s.params.id}`, data: { section: "z" } },
];

@NgModule({
  imports: [CommonModule, RouterModule.forRoot(routes)],
  declarations: [TtsRoot, PageA, PageB, PageD],
  providers: [{ provide: TitleStrategy, useClass: SuffixTitleStrategy }],
})
class AppModule {}

let appRef: { destroy(): void; injector: unknown } | undefined;

async function boot() {
  const host = document.createElement("tts-root");
  document.body.appendChild(host);
  appRef = await bootstrapApplication(AppModule, { hostElement: host });
  const injector = appRef.injector as angular.auto.IInjectorService;
  return {
    router: injector.get<Router>(Router.$name),
    $rootScope: injector.get<angular.IRootScopeService>("$rootScope"),
  };
}

afterEach(() => {
  appRef?.destroy();
  appRef = undefined;
  applied.length = 0;
});

describe("ngjs-core/router — TitleStrategy (básico)", () => {
  it("un TitleStrategy provisto por DI reemplaza cómo se aplica el título de la ruta", async () => {
    const { router, $rootScope } = await boot();

    await router.navigateByUrl("/a");
    $rootScope.$digest();
    $rootScope.$digest();
    expect(applied).toEqual(["A"]);
    expect(document.title).toBe("A · Mi App");

    // ruta sin `title` → el strategy no se llama (el título queda como estaba)
    await router.navigateByUrl("/b");
    $rootScope.$digest();
    $rootScope.$digest();
    expect(applied).toEqual(["A"]);
    expect(document.title).toBe("A · Mi App");
  });

  it("la ResolveFn del título recibe la `data` real del estado (no `{}`)", async () => {
    const { router, $rootScope } = await boot();

    await router.navigateByUrl("/d/7");
    $rootScope.$digest();
    $rootScope.$digest();

    expect(applied).toEqual(["D/z/7"]);
    expect(document.title).toBe("D/z/7 · Mi App");
  });
});
