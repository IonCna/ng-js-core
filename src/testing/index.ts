/**
 * `ngjs-core/testing` — el `TestBed` de `@angular/core/testing` sobre AngularJS, con clases compiladas por
 * `ng-js-compiler`: `TestBed.configureTestingModule({ imports, declarations, providers })`, `TestBed.inject(Foo)`,
 * `TestBed.createComponent(Cmp)` → `ComponentFixture`.
 */
export { ComponentFixture } from "@/testing/component-fixture.ts";
export {
  getTestBed,
  inject,
  type MetadataOverride,
  type ModuleTeardownOptions,
  TestBed,
  TestBedImpl,
  type TestEnvironmentOptions,
  type TestModuleMetadata,
} from "@/testing/test-bed.ts";
