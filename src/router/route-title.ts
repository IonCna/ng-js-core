import type { Data, ResolveFn } from "@/router/route.ts";

/** Mismo nombre/semántica que `withRouterConfig({ paramsInheritanceStrategy })` de `@angular/router`. */
export type ParamsInheritanceStrategy = "emptyOnly" | "always";

/** Contexto que recibe una `title: ResolveFn<string>` — el mismo en `wireTitles` y en `ActivatedRoute`. */
export interface RouteTitleContext {
  params: Record<string, string>;
  data: Data;
  queryParams: Record<string, string>;
  fragment: string | null;
}

/**
 * Del chain de estados activos (root → hoja), el `title` definido más profundo
 * (string literal o `ResolveFn`), o `undefined` si ninguno define `title`.
 */
export function pickRouteTitle(
  chain: { name: string }[],
  titles: Map<string, string | ResolveFn<string>>,
): string | ResolveFn<string> | undefined {
  let picked: string | ResolveFn<string> | undefined;
  for (const node of chain) {
    const candidate = titles.get(node.name);
    if (candidate !== undefined) picked = candidate;
  }
  return picked;
}

/** State name del que sale el `title` que elige `pickRouteTitle` (el más profundo con `title`). */
export function pickRouteTitleState(
  chain: { name: string }[],
  titles: Map<string, string | ResolveFn<string>>,
): string | undefined {
  let picked: string | undefined;
  for (const node of chain) if (titles.has(node.name)) picked = node.name;
  return picked;
}

/**
 * `data` estática efectiva del estado activo más profundo, según
 * `paramsInheritanceStrategy` (mismo nombre/semántica que `@angular/router`):
 *
 * - `'always'`: mergea la `data` estática de TODA la cadena root → hoja (el
 *   hijo gana en choques).
 * - `'emptyOnly'` (default, paridad con el default de Angular): solo hereda
 *   la `data` del padre mientras, subiendo desde la hoja, cada state tenga
 *   `path` vacío (`""`) — el idiom de "ruta contenedora sin URL propia". Un
 *   state con `path` propio no vacío corta la herencia ahí.
 */
export function mergeStaticData(
  chain: { name: string; data?: Data }[],
  emptyPathStates: Set<string>,
  strategy: ParamsInheritanceStrategy,
): Data {
  if (chain.length === 0) return {};
  if (strategy === "always") {
    return chain.reduce<Data>((acc, node) => ({ ...acc, ...(node.data ?? {}) }), {});
  }
  let merged: Data = { ...(chain[chain.length - 1].data ?? {}) };
  for (let i = chain.length - 1; i > 0; i--) {
    if (!emptyPathStates.has(chain[i].name)) break;
    merged = { ...(chain[i - 1].data ?? {}), ...merged };
  }
  return merged;
}

/**
 * `data` estática del estado activo + los valores de `resolve` ya disponibles en
 * el injector de la transición (Angular: `data` = estático + resueltos). Sin
 * injector devuelve solo la estática.
 */
export function mergeResolvedData(
  chain: { name: string }[],
  resolveKeys: Map<string, string[]>,
  staticData: Data,
  injector: { get(key: string): unknown } | undefined,
): Data {
  const data: Data = { ...staticData };
  if (!injector) return data;
  for (const node of chain) {
    for (const key of resolveKeys.get(node.name) ?? []) {
      try {
        data[key] = injector.get(key);
      } catch {
        /* aún no resuelto */
      }
    }
  }
  return data;
}
