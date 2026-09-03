import * as esbuild from "esbuild";

const host = "127.0.0.1";

const context = await esbuild.context({
  entryPoints: ["reference/demo/main.ts"],
  bundle: true,
  format: "iife",
  outfile: "reference/demo/dist/main.js",
  platform: "browser",
  sourcemap: true,
  target: ["es2022"],
});

await context.watch();

const server = await context.serve({
  host,
  port: 8000,
  servedir: "reference/demo",
});

console.log(`Demo disponible en http://${host}:${server.port}`);
