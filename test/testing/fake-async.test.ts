import { describe, expect, it } from "vitest";
import { discardPeriodicTasks, fakeAsync, flush, flushMicrotasks, tick, waitForAsync } from "@/testing/fake-async.ts";

/**
 * Sin los parches de zona de `ng-js-compiler` (proyecto `unit`): `fakeAsync` reemplaza los timers globales él mismo.
 * Con los parches (la app/`ngjs test`) lo prueba `fake-async.compiled.test.ts`.
 */
describe("fakeAsync (sin parches de zona)", () => {
  it("tick() corre los timers que vencen, en orden, y Date avanza con el reloj falso", () => {
    const log: string[] = [];
    let start = 0;
    let after = 0;
    fakeAsync(() => {
      start = Date.now();
      setTimeout(() => log.push("b@20"), 20);
      setTimeout(() => log.push("a@10"), 10);
      setTimeout(() => log.push("c@20"), 20);
      tick(15);
      expect(log).toEqual(["a@10"]);
      tick(5);
      after = new Date().getTime();
    })();
    expect(log).toEqual(["a@10", "b@20", "c@20"]);
    expect(after - start).toBe(20);
  });

  it("las promesas corren en flushMicrotasks()/tick(), no solas; un timer que agenda otro dentro del tick también corre", () => {
    const log: string[] = [];
    fakeAsync(() => {
      Promise.resolve(1)
        .then((value) => log.push(`then ${value}`))
        .finally(() => log.push("finally"));
      expect(log).toEqual([]);
      flushMicrotasks();
      expect(log).toEqual(["then 1", "finally"]);

      setTimeout(() => {
        log.push("outer");
        setTimeout(() => log.push("inner"), 5);
        Promise.resolve().then(() => log.push("micro"));
      }, 5);
      tick(10);
    })();
    expect(log).toEqual(["then 1", "finally", "outer", "micro", "inner"]);
  });

  it("Promise.all/allSettled/race/any sobre el reloj falso", () => {
    const results: unknown[] = [];
    fakeAsync(() => {
      const later = (value: string, ms: number) =>
        new Promise<string>((resolve) => setTimeout(() => resolve(value), ms));
      Promise.all([later("a", 10), "b", later("c", 5)]).then((values) => results.push(values));
      Promise.race([later("slow", 10), later("fast", 5)]).then((value) => results.push(value));
      Promise.allSettled([Promise.reject(new Error("x")), later("ok", 1)]).then((values) =>
        results.push(values.map((item) => item.status)),
      );
      Promise.any([Promise.reject(new Error("no")), later("any", 3)]).then((value) => results.push(value));
      tick(10);
    })();
    expect(results).toEqual([["rejected", "fulfilled"], "any", "fast", ["a", "b", "c"]]);
  });

  it("al terminar: timers pendientes son error (salvo con { flush: true }); intervalos, error salvo discardPeriodicTasks()", () => {
    expect(fakeAsync(() => void setTimeout(() => {}, 100))).toThrow("1 timer(s) still in the queue.");
    let ran = false;
    fakeAsync(() => void setTimeout(() => (ran = true), 100), { flush: true })();
    expect(ran).toBe(true);

    expect(fakeAsync(() => void setInterval(() => {}, 10))).toThrow("1 periodic timer(s) still in the queue.");
    let count = 0;
    fakeAsync(() => {
      setInterval(() => count++, 10);
      tick(35);
      discardPeriodicTasks();
    })();
    expect(count).toBe(3);
  });

  it("flush() corre los no periódicos y devuelve el tiempo avanzado; un polling sin fin corta en maxTurns", () => {
    let elapsed = 0;
    fakeAsync(() => {
      setTimeout(() => setTimeout(() => {}, 30), 20);
      elapsed = flush();
    })();
    expect(elapsed).toBe(50);

    const poll = () => void setTimeout(poll, 10);
    expect(
      fakeAsync(() => {
        poll();
        flush();
      }),
    ).toThrow(/flush failed after reaching the limit of 20 tasks/);
  });

  it("clearTimeout/clearInterval cancelan en el reloj falso", () => {
    let ran = false;
    fakeAsync(() => {
      const id = setTimeout(() => (ran = true), 10);
      clearTimeout(id);
      const interval = setInterval(() => (ran = true), 10);
      clearInterval(interval);
      tick(100);
    })();
    expect(ran).toBe(false);
  });

  it("un rechazo sin manejar es error; con catch, no", () => {
    expect(fakeAsync(() => void Promise.reject(new Error("boom")))).toThrow("Uncaught (in promise): Error: boom");
    expect(fakeAsync(() => void Promise.reject(new Error("boom")).catch(() => {}))).not.toThrow();
  });

  it("no se anida; tick() afuera es error; al terminar vuelven Promise, Date y los timers de verdad", () => {
    const { Promise: RealPromise, Date: RealDate, setTimeout: realSetTimeout } = globalThis;
    expect(fakeAsync(() => fakeAsync(() => {})())).toThrow("fakeAsync() calls can not be nested");
    expect(() => tick()).toThrow(/fakeAsync zone/);
    expect(
      fakeAsync(() => {
        throw new Error("test");
      }),
    ).toThrow("test");
    expect(globalThis.Promise).toBe(RealPromise);
    expect(globalThis.Date).toBe(RealDate);
    expect(globalThis.setTimeout).toBe(realSetTimeout);
  });
});

describe("waitForAsync", () => {
  it("termina cuando termina el trabajo async del test (timers encadenados), no antes", async () => {
    const log: string[] = [];
    await waitForAsync(() => {
      setTimeout(() => {
        log.push("first");
        setTimeout(() => log.push("second"), 5);
      }, 5);
    })();
    expect(log).toEqual(["first", "second"]);
  });
});
