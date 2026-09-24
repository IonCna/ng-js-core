import angular from "angular";
import "angular-animate";
import { AnimationBuilder, BrowserAnimationBuilder, NoopAnimationBuilder } from "@/animations/animation-builder.ts";
import type { Provider } from "@/core/di/provider.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";

const NgAnimateModule = angular.module("ngAnimate");

@NgModule({
  imports: [NgAnimateModule],
  providers: [{ provide: AnimationBuilder, useClass: BrowserAnimationBuilder }],
})
export class BrowserAnimationsModule {}

/** Como en Angular, `NoopAnimationsModule` apaga las animaciones: también las de `ngAnimate` (`$animate`). */
const NoopAnimateModule = angular.module("ng.js.animations.noop", ["ngAnimate"]).run([
  "$animate",
  ($animate: { enabled(value: boolean): void }) => $animate.enabled(false),
]);

@NgModule({
  imports: [NoopAnimateModule],
  providers: [{ provide: AnimationBuilder, useClass: NoopAnimationBuilder }],
})
export class NoopAnimationsModule {}

export function provideAnimations(): Provider[] {
  return [{ provide: AnimationBuilder, useClass: BrowserAnimationBuilder }];
}

export function provideNoopAnimations(): Provider[] {
  return [{ provide: AnimationBuilder, useClass: NoopAnimationBuilder }];
}
