/**
 * `ngjs-core/animations` — superficie de `@angular/animations` (la DSL:
 * `trigger`/`state`/`style`/`animate`/…) + `AnimationBuilder`/`AnimationPlayer`.
 * Quién ejecuta la animación lo decide el `AnimationDriver` de
 * `ngjs-core/animations/browser` (por defecto, `$animateCss` de `ngAnimate`).
 *
 * Solo superficie de clase: la metadata que va en `@Component({ animations: [...] })`
 * y el input de `AnimationBuilder`. La sintaxis de template (`[@trigger]`,
 * `(@t.done)`, `:enter`/`:leave`) la agrega el CLI — ver "Regla de coherencia" en
 * `docs/ORDEN-DE-CONSTRUCCION.md`.
 */

export type { ɵAnimationSegment } from "@/animations/animation-builder.ts";
export {
  AnimationBuilder,
  AnimationFactory,
  BrowserAnimationBuilder,
  ɵflattenAnimationToSegments,
  ɵparseAnimationTimings,
} from "@/animations/animation-builder.ts";
export { AnimationMetadataType } from "@/animations/animation-metadata.ts";
export type { AnimationPlayer } from "@/animations/animation-player.ts";
export { NoopAnimationPlayer } from "@/animations/animation-player.ts";
export {
  BrowserAnimationsModule,
  NoopAnimationsModule,
  provideAnimations,
  provideNoopAnimations,
} from "@/animations/animations.module.ts";
export type {
  AnimateChildOptions,
  AnimateTimings,
  AnimationAnimateChildMetadata,
  AnimationAnimateMetadata,
  AnimationAnimateRefMetadata,
  AnimationGroupMetadata,
  AnimationKeyframesSequenceMetadata,
  AnimationMetadata,
  AnimationOptions,
  AnimationQueryMetadata,
  AnimationQueryOptions,
  AnimationReferenceMetadata,
  AnimationSequenceMetadata,
  AnimationStaggerMetadata,
  AnimationStateMetadata,
  AnimationStyleMetadata,
  AnimationStyleTokens,
  AnimationTransitionMetadata,
  AnimationTriggerMetadata,
  TransitionExpr,
  ɵStyleData,
  ɵStyleDataMap,
} from "@/animations/dsl.ts";
export {
  animate,
  animateChild,
  animation,
  group,
  keyframes,
  query,
  sequence,
  stagger,
  state,
  style,
  transition,
  trigger,
  useAnimation,
} from "@/animations/dsl.ts";
