import angular from "angular";
import "angular-animate";
import type { Provider } from "@/core/di/provider.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import {
  AnimationBuilder,
  BrowserAnimationBuilder,
  NoopAnimationBuilder,
} from "@/animations/animation-builder.ts";

const NgAnimateModule = angular.module("ngAnimate");

@NgModule({
  imports: [NgAnimateModule],
  providers: [{ provide: AnimationBuilder, useClass: BrowserAnimationBuilder }],
})
export class BrowserAnimationsModule {}

@NgModule({
  imports: [NgAnimateModule],
  providers: [{ provide: AnimationBuilder, useClass: NoopAnimationBuilder }],
})
export class NoopAnimationsModule {}

export function provideAnimations(): Provider[] {
  return [{ provide: AnimationBuilder, useClass: BrowserAnimationBuilder }];
}

export function provideNoopAnimations(): Provider[] {
  return [{ provide: AnimationBuilder, useClass: NoopAnimationBuilder }];
}
