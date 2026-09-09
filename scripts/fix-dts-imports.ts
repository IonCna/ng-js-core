/**
 * Post-proceso de `dist/**\/*.d.ts`: reescribe los especificadores de módulo que
 * quedan con extensión `.ts` (heredada de `allowImportingTsExtensions` +
 * `verbatimModuleSyntax` en el fuente) a `.js`, resolviendo también los barrels
 * (`./x.ts` → `./x/index.js` si `x` es carpeta).
 *
 * `tsc` emite `export * from "./core/index.ts"` en los `.d.ts` porque
 * `allowImportingTsExtensions` no reescribe la extensión al emitir, y `tsc-alias`
 * solo resuelve el alias `@/*` a relativo (sin tocar la extensión). Sin este paso
 * un consumidor con `moduleResolution: "node16"/"nodenext"` no resuelve los tipos.
 *
 * Cubre TODOS los subpaths publicados (`compat`, `runtime/*`, `cdk/*`, `router`,
 * `i18n`, …) porque recorre `dist/` entero. Idempotente.
 */
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

async function listDeclarations(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return listDeclarations(path);
      return Promise.resolve(entry.name.endsWith(".d.ts") ? [path] : []);
    }),
  );
  return nested.flat();
}

/** Reescribe un especificador relativo con `.ts` al `.js` real (archivo o barrel). */
function rewriteSpecifier(fromFile: string, specifier: string): string {
  if (!/^\.\.?\//.test(specifier) || !/\.tsx?$/.test(specifier)) return specifier;

  const base = resolve(dirname(fromFile), specifier).replace(/\.tsx?$/, "");

  let target: string;
  if (existsSync(`${base}.d.ts`)) target = `${base}.js`;
  else if (existsSync(join(base, "index.d.ts"))) target = join(base, "index.js");
  else target = `${base}.js`; // fallback: cambiar extensión a secas

  let rewritten = relative(dirname(fromFile), target).split(sep).join("/");
  if (!rewritten.startsWith(".")) rewritten = `./${rewritten}`;
  return rewritten;
}

let touched = 0;
for (const file of await listDeclarations(distDir)) {
  const source = await readFile(file, "utf8");
  // Cualquier string entrecomillada que parezca un especificador relativo: cubre
  // `from "..."`, `import "..."` y los `import("...")` inline de tipos.
  const next = source.replace(
    /(["'])(\.\.?\/[^"']+)\1/g,
    (_m, quote: string, spec: string) => `${quote}${rewriteSpecifier(file, spec)}${quote}`,
  );
  if (next !== source) {
    await writeFile(file, next);
    touched += 1;
  }
}

console.log(`fix-dts-imports: ${touched} archivo(s) .d.ts normalizado(s)`);
