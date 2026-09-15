import { Component } from "@/core/metadata/component.ts";
import type { Routes } from "@/router/index.ts";
import { preloadCounters } from "./counters.ts";

/** Chunk lazy con otra ruta lazy adentro — el preloader tiene que bajar las dos. */

@Component({ selector: "nested-page", template: "<h2>nested page</h2>" })
export class NestedPage {}

export const NESTED_ROUTES: Routes = [
  { path: "", component: NestedPage },
  {
    path: "deep",
    loadChildren: () => {
      preloadCounters.deep += 1;
      return import("./deep.routes.ts").then((m) => m.DEEP_ROUTES);
    },
  },
];
