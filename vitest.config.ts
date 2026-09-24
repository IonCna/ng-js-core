import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** El compilador que usa `ngjs build` (su `dist/`): los tests compilados arman fixtures + `src/` con la cadena real. */
const compiler = (entry: string) => fileURLToPath(new URL(`../plugins/ng-js-compiler/dist/${entry}`, import.meta.url));

const alias = [
  { find: /^ng-js-compiler\/esbuild$/, replacement: compiler("esbuild.js") },
  { find: /^ng-js-compiler$/, replacement: compiler("index.js") },
  { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
];

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        // Lógica pura del core (forms, http, pipes, DSL de animaciones, cdk, …): las clases se importan de `src/` y se
        // construyen a mano, sobre jsdom + `angular-mocks` cuando hace falta un `$injector`.
        resolve: { alias },
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./test/setup.ts"],
          include: ["test/**/*.test.ts"],
          exclude: ["test/**/*.compiled.test.ts"],
        },
      },
      {
        // Integración: cada fixture se compila con `ng-js-compiler` junto con `src/` y corre en su propia ventana
        // jsdom (`test/compiled-app.ts`). En Node: esbuild no corre dentro del entorno jsdom de vitest.
        resolve: { alias },
        test: {
          name: "compiled",
          environment: "node",
          include: ["test/**/*.compiled.test.ts"],
          testTimeout: 30000,
        },
      },
    ],
  },
});
