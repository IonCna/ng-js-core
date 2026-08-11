import type { ProviderToken, QueryDescriptor, QueryReference } from "@/core/queries/query-types";
import type { QueryReferenceStore } from "@/core/queries/reference-store";

export function queryAcceptsReference(
  query: QueryDescriptor,
  locator: string,
  candidates: ReadonlyMap<ProviderToken<unknown>, unknown>,
): boolean {
  const matchesLocator = typeof query.locator === "string" ? query.locator === locator : candidates.has(query.locator);
  return matchesLocator || (query.read !== undefined && candidates.has(query.read));
}

function matchesLocator(query: QueryDescriptor, reference: QueryReference): boolean {
  return typeof query.locator === "string"
    ? reference.locator === query.locator
    : reference.candidates.has(query.locator);
}

function matchesDepth(query: QueryDescriptor, reference: QueryReference, contentRoots?: ReadonlySet<Node>): boolean {
  return (
    contentRoots === undefined ||
    query.descendants === true ||
    (reference.node !== undefined && contentRoots.has(reference.node))
  );
}

function getReadToken(query: QueryDescriptor): ProviderToken<unknown> | undefined {
  return query.read ?? (typeof query.locator === "string" ? undefined : query.locator);
}

export function resolveFirst(
  query: QueryDescriptor,
  store: QueryReferenceStore,
  contentRoots?: ReadonlySet<Node>,
): unknown {
  const references = store.ordered();
  const reference = references.find(
    (candidate) => matchesLocator(query, candidate) && matchesDepth(query, candidate, contentRoots),
  );

  return reference ? store.read(reference, getReadToken(query), references) : undefined;
}

export function resolveAll(
  query: QueryDescriptor,
  store: QueryReferenceStore,
  contentRoots?: ReadonlySet<Node>,
): readonly unknown[] {
  const references = store.ordered();
  const readToken = getReadToken(query);
  const matchedNodes = new Set<Node>();

  return references.flatMap((reference) => {
    if (!matchesLocator(query, reference) || !matchesDepth(query, reference, contentRoots)) return [];

    if (reference.node !== undefined) {
      if (matchedNodes.has(reference.node)) return [];
      matchedNodes.add(reference.node);
    }

    const value = store.read(reference, readToken, references);
    return value === undefined ? [] : [value];
  });
}
