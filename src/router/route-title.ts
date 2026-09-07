import type { Data, ResolveFn } from "@/router/route.ts";

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
