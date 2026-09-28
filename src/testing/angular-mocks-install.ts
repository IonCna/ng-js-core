/**
 * Corre ANTES de `import "angular-mocks"` (ver `angular-mocks.ts`). `angular-mocks` solo define
 * `angular.mock.module`/`angular.mock.inject` si al cargarse ve `window.jasmine` o `window.mocha`, y en ese caso
 * engancha sus propios `beforeEach`/`afterEach` globales. Acá se le da un `mocha` de mentira (si no hay framework) y
 * hooks vacíos: el ciclo de vida del spec de `angular.mock` lo maneja `TestBed` (ver `MockSpec`), no el runner.
 * `angular-mocks-restore.ts` devuelve todo como estaba.
 */
type Globals = Record<string, unknown>;

const target = (typeof window !== "undefined" ? window : globalThis) as unknown as Globals;
const KEYS = ["mocha", "beforeEach", "afterEach", "setup", "teardown", "module", "inject"] as const;
const noop = () => undefined;

export const previousGlobals: { target: Globals; values: Map<string, PropertyDescriptor | undefined> } = {
  target,
  values: new Map(KEYS.map((key) => [key, Object.getOwnPropertyDescriptor(target, key)])),
};

if (!target.jasmine && !target.mocha) target.mocha = {};
target.beforeEach = noop;
target.afterEach = noop;
