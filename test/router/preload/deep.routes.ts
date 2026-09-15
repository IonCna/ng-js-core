import { Component } from "@/core/metadata/component.ts";
import type { Routes } from "@/router/index.ts";

@Component({ selector: "deep-page", template: "<h2>deep page</h2>" })
export class DeepPage {}

export const DEEP_ROUTES: Routes = [{ path: "", component: DeepPage }];
