import { previousGlobals } from "@/testing/angular-mocks-install.ts";

/** Corre DESPUÉS de `import "angular-mocks"`: devuelve los globals que tocó `angular-mocks-install.ts` (y los
 * `window.module`/`window.inject` que publica `angular-mocks`). `angular.mock.*` queda definido igual. */
const { target, values } = previousGlobals;
for (const [key, descriptor] of values) {
  if (descriptor) Object.defineProperty(target, key, descriptor);
  else delete target[key];
}
