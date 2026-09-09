import "reflect-metadata";

export { ChangeDetectorRef } from "./change-detection/change-detector-ref.ts";
export * from "./di/index.ts";
// `DOCUMENT` — `@angular/core` desde Angular 20 (re-exportado por `ngjs-core/common`).
export { DOCUMENT } from "./dom-tokens.ts";
export * from "./lifecycle/index.ts";
export * from "./metadata/index.ts";
export { NgDisabled } from "./ng-disabled.ts";
export * from "./platform/index.ts";
export * from "./queries/index.ts";
export * from "./refs/index.ts";
