import { afterEach, describe, expect, it } from "vitest";
import { CompiledApp } from "../compiled-app.ts";

/**
 * `fakeAsync` con los parches de zona de `ng-js-compiler` (como en `ngjs test`): el `ComponentFixture` — y con él el
 * `$browser` de AngularJS, que guarda `setTimeout` al crearse — existe ANTES del `fakeAsync`, y aun así `setTimeout`,
 * `$timeout` (el de `ngMock`, que `TestBed` trae) y `async`/`await` quedan en el reloj falso.
 */
describe("fakeAsync sobre los parches de zona (código compilado)", () => {
  let app: CompiledApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  it("setTimeout, $timeout y async/await avanzan con tick()/flushMicrotasks(); fuera de fakeAsync, $timeout.flush() sigue igual", async () => {
    app = await CompiledApp.bootstrap({
      "app.module.ts": `
import { Component, Inject, NgModule } from "ngjs-core";
import { fakeAsync, flushMicrotasks, tick, TestBed } from "ngjs-core/testing";

@Component({ selector: "fa-clock", template: "<span>{{ $ctrl.text }}</span>" })
export class Clock {
  text = "start";
  constructor(@Inject("$timeout") private readonly $timeout: (fn: () => void, ms: number) => unknown) {}
  later(): void { setTimeout(() => (this.text = "timeout"), 100); }
  angularLater(): void { this.$timeout(() => (this.text = "$timeout"), 50); }
  async load(): Promise<void> {
    await Promise.resolve();
    this.text = "await";
  }
}

@NgModule({})
export class AppModule {}

(globalThis as any).scenario = () => {
  TestBed.configureTestingModule({ declarations: [Clock] });
  const fixture = TestBed.createComponent(Clock);
  fixture.detectChanges();
  // Como en Angular: el fixture se ve recién con detectChanges().
  const text = () => {
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent!.trim();
  };
  const seen: string[] = [text()];
  fakeAsync(() => {
    fixture.componentInstance.later();
    tick(99);
    seen.push(text());
    tick(1);
    seen.push(text());
    fixture.componentInstance.angularLater();
    tick(50);
    seen.push(text());
    fixture.componentInstance.load();
    seen.push(text());
    flushMicrotasks();
    seen.push(text());
  })();
  // Afuera de fakeAsync, el $timeout de ngMock vuelve a su cola de siempre.
  fixture.componentInstance.text = "reset";
  fixture.componentInstance.angularLater();
  TestBed.inject<{ flush(): void }>("$timeout" as never).flush();
  seen.push(text());
  return seen;
};
`,
    });

    expect(app.global<() => string[]>("scenario")()).toEqual([
      "start",
      "start",
      "timeout",
      "$timeout",
      "$timeout",
      "await",
      "$timeout",
    ]);
    expect(app.errors).toEqual([]);
  });
});
