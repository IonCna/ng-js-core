/** Contadores compartidos entre el test de preloading y sus chunks lazy. */
export const preloadCounters = { admin: 0, nested: 0, deep: 0, page: 0, skipped: 0 };

export function resetPreloadCounters(): void {
  for (const key of Object.keys(preloadCounters) as (keyof typeof preloadCounters)[]) preloadCounters[key] = 0;
}
