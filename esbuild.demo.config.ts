import * as esbuild from "esbuild";

const host = "127.0.0.1";

const context = await esbuild.context({
  entryPoints: ["demo/main.ts"],
  bundle: true,
  format: "iife",
  outfile: "demo/dist/main.js",
  platform: "browser",
  sourcemap: true,
  target: ["es2022"],
});

await context.watch();

const server = await context.serve({
  host,
  port: 8000,
  servedir: "demo",
});

console.log(`Demo disponible en http://${host}:${server.port}`);
