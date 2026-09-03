// `angular-mocks` detecta el framework de tests por `window.jasmine` / `window.mocha`
// y solo entonces conecta `angular.mock.module` / `angular.mock.inject` a los hooks.
// Bajo vitest no hay ninguno, así que fingimos mocha y puenteamos beforeEach/afterEach.
import { afterEach, beforeEach } from "vitest";

if (typeof window !== "undefined") {
  let specContext: Record<string, unknown> = {};
  const w = window as typeof window & {
    mocha: Record<string, unknown>;
    beforeEach: (hook: () => void) => void;
    afterEach: (hook: () => void) => void;
  };

  w.mocha = {};
  w.beforeEach = (hook: () => void) =>
    beforeEach(() => {
      specContext = {};
      return hook.call(specContext);
    });
  w.afterEach = (hook: () => void) => afterEach(() => hook.call(specContext));
}
