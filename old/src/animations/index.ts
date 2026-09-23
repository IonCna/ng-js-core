/**
 * `ngjs-core/animations` — superficie de `@angular/animations` (la DSL:
 * `trigger`/`state`/`style`/`animate`/…) + `AnimationBuilder`/`AnimationPlayer`
 * sobre `$animateCss` de `ngAnimate`.
 *
 * Solo superficie de clase: la metadata que va en `@Component({ animations: [...] })`
 * y el input de `AnimationBuilder`. La sintaxis de template (`[@trigger]`,
 * `(@t.done)`, `:enter`/`:leave`) la agrega el CLI — ver "Regla de coherencia" en
 * `docs/ORDEN-DE-CONSTRUCCION.md`.
 */

export type { AnimationPlayer, ɵAnimationSegment } from "@/animations/animation-builder.ts";
export {
  AnimationBuilder,
  AnimationFactory,
  BrowserAnimationBuilder,
  NoopAnimationBuilder,
  NoopAnimationPlayer,
  ɵflattenAnimationToSegments,
  ɵparseAnimationTimings,
} from "@/animations/animation-builder.ts";
export { AnimationMetadataType } from "@/animations/animation-metadata.ts";
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
