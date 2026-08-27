import type { ViewRef } from "@/core/abstractions/view-ref";

export interface ViewOwner {
  readonly viewOwnerKind: "application" | "container";
}

const owners = new WeakMap<ViewRef, ViewOwner>();

export function getViewOwner(viewRef: ViewRef): ViewOwner | undefined {
  return owners.get(viewRef);
}

export function claimView(viewRef: ViewRef, owner: ViewOwner): void {
  const currentOwner = owners.get(viewRef);
  if (currentOwner === owner) return;

  if (currentOwner) {
    throw new Error(`La vista ya pertenece a un ${currentOwner.viewOwnerKind}`);
  }

  owners.set(viewRef, owner);
}

export function releaseView(viewRef: ViewRef, owner: ViewOwner): void {
  if (owners.get(viewRef) === owner) owners.delete(viewRef);
}
