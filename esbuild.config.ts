import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: [
    "src/index.ts",
    "src/core/index.ts",
    "src/common/index.ts",
    "src/core/platform/index.ts",
    "src/rxjs-interop/index.ts",
    "src/runtime/index.ts",
    "src/runtime/core/index.ts",
    "src/runtime/common/index.ts",
    "src/runtime/testing/index.ts",
    "src/compat/index.ts",
    "src/router/index.ts",
  ],
  bundle: true,
  format: "esm",
  splitting: true,
  outdir: "dist",
  outbase: "src",
  platform: "browser",
  external: ["angular", "rxjs", "rxjs/*", "zone.js", "zone.js/*", "@uirouter/angularjs"],
  sourcemap: true,
  target: ["es2022"],
});
