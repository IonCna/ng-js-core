import type { ProviderToken, QueryReference } from "@/core/queries/query-types";

function sortByDocumentOrder(references: readonly QueryReference[]): QueryReference[] {
  return references
    .map((reference, index) => ({ index, reference }))
    .sort((left, right) => {
      const leftNode = left.reference.node;
      const rightNode = right.reference.node;
      if (!leftNode || !rightNode || leftNode === rightNode) return left.index - right.index;

      const position = leftNode.compareDocumentPosition(rightNode);
      if (position & 1) return left.index - right.index;
      if (position & 4) return -1;
      if (position & 2) return 1;
      return left.index - right.index;
    })
    .map(({ reference }) => reference);
}

export class QueryReferenceStore {
  private orderedReferences?: readonly QueryReference[];
  private readonly references: QueryReference[] = [];

  connect(reference: QueryReference): () => void {
    this.references.push(reference);
    this.orderedReferences = undefined;

    return () => {
      const index = this.references.indexOf(reference);
      if (index === -1) return;

      this.references.splice(index, 1);
      this.orderedReferences = undefined;
    };
  }

  ordered(): readonly QueryReference[] {
    this.orderedReferences ??= sortByDocumentOrder(this.references);
    return this.orderedReferences;
  }

  read(
    reference: QueryReference,
    readToken: ProviderToken<unknown> | undefined,
    orderedReferences: readonly QueryReference[],
  ): unknown {
    if (readToken === undefined) return reference.defaultValue;

    const value = reference.candidates.get(readToken);
    if (value !== undefined || reference.node === undefined) return value;

    for (const candidate of orderedReferences) {
      if (candidate.node !== reference.node) continue;

      const siblingValue = candidate.candidates.get(readToken);
      if (siblingValue !== undefined) return siblingValue;
    }

    return undefined;
  }
}
