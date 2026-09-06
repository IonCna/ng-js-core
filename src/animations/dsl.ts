import { AnimationMetadataType } from "@/animations/animation-metadata.ts";

/**
 * La **DSL de autoría** de `@angular/animations` (`trigger`/`state`/`style`/
 * `animate`/`transition`/`keyframes`/`group`/`sequence`/`query`/`stagger`/
 * `animation`/`useAnimation`/`animateChild`) — funciones **puras** que arman un
 * árbol de metadata `{ type, ... }` donde `type` es `AnimationMetadataType`
 * (0–12). No animan nada: describen. La interpretación (traducir cada
 * `transition` a `$animateCss`) vive fuera — en la directiva `[@trigger]` que
 * agrega el CLI, ver `docs/ORDEN-DE-CONSTRUCCION.md` etapa 17 y la "Regla de
 * coherencia".
 *
 * Las firmas y la **forma exacta de cada nodo** replican `@angular/animations`
 * tal cual: un codemod / el CLI comparan `node.type` contra los enteros y leen
 * `node.expr` / `node.styles` / `node.timings` / … con esos nombres.
 */

// --- Tipos de soporte -----------------------------------------------------

/** Valores CSS de un `style({...})`. `"*"` = "el valor computado / auto". */
export type ɵStyleData = { [key: string]: string | number };
export type AnimationStyleTokens = "*" | ɵStyleData | Array<"*" | ɵStyleData>;

/** `"300ms"`, `"0.3s ease-in"`, `"300ms 100ms ease-out"`, o un número (= ms). */
export type AnimateTimings = string | number;

export interface AnimationOptions {
  delay?: number | string;
  params?: { [name: string]: unknown };
}

export interface AnimateChildOptions extends AnimationOptions {
  duration?: number | string;
}

export interface AnimationQueryOptions extends AnimationOptions {
  /** Si `false` (default) y el selector no matchea nada → error. */
  optional?: boolean;
  /** Corta la cantidad de elementos matcheados (negativo = desde el final). */
  limit?: number;
}

/**
 * Expresión de matching de `transition(...)`: `"abierto => cerrado"`,
 * `"a <=> b"`, `"* => cerrado"`, los alias `":enter"` / `":leave"` /
 * `":increment"` / `":decrement"`, o un predicado.
 */
export type TransitionExpr =
  | string
  | ((fromState: string, toState: string, element?: unknown, params?: { [key: string]: unknown }) => boolean);

// --- Nodos de metadata --------------------------------------------------

export interface AnimationMetadata {
  type: AnimationMetadataType;
}

export interface AnimationTriggerMetadata extends AnimationMetadata {
  type: AnimationMetadataType.Trigger;
  name: string;
  definitions: AnimationMetadata[];
  options: AnimationOptions | null;
}

export interface AnimationStateMetadata extends AnimationMetadata {
  type: AnimationMetadataType.State;
  name: string;
  styles: AnimationStyleMetadata;
  options?: { params: { [name: string]: unknown } };
}

export interface AnimationTransitionMetadata extends AnimationMetadata {
  type: AnimationMetadataType.Transition;
  expr: TransitionExpr;
  animation: AnimationMetadata | AnimationMetadata[];
  options: AnimationOptions | null;
}

export interface AnimationStyleMetadata extends AnimationMetadata {
  type: AnimationMetadataType.Style;
  styles: AnimationStyleTokens;
  offset: number | null;
}

export interface AnimationAnimateMetadata extends AnimationMetadata {
  type: AnimationMetadataType.Animate;
  timings: AnimateTimings;
  styles: AnimationStyleMetadata | AnimationKeyframesSequenceMetadata | null;
}

export interface AnimationKeyframesSequenceMetadata extends AnimationMetadata {
  type: AnimationMetadataType.Keyframes;
  steps: AnimationStyleMetadata[];
}

export interface AnimationGroupMetadata extends AnimationMetadata {
  type: AnimationMetadataType.Group;
  steps: AnimationMetadata[];
  options: AnimationOptions | null;
}

export interface AnimationSequenceMetadata extends AnimationMetadata {
  type: AnimationMetadataType.Sequence;
  steps: AnimationMetadata[];
  options: AnimationOptions | null;
}

export interface AnimationReferenceMetadata extends AnimationMetadata {
  type: AnimationMetadataType.Reference;
  animation: AnimationMetadata | AnimationMetadata[];
  options: AnimationOptions | null;
}

export interface AnimationAnimateChildMetadata extends AnimationMetadata {
  type: AnimationMetadataType.AnimateChild;
  options: AnimationOptions | null;
}

export interface AnimationAnimateRefMetadata extends AnimationMetadata {
  type: AnimationMetadataType.AnimateRef;
  animation: AnimationReferenceMetadata;
  options: AnimationOptions | null;
}

export interface AnimationQueryMetadata extends AnimationMetadata {
  type: AnimationMetadataType.Query;
  selector: string;
  animation: AnimationMetadata | AnimationMetadata[];
  options: AnimationQueryOptions | null;
}

export interface AnimationStaggerMetadata extends AnimationMetadata {
  type: AnimationMetadataType.Stagger;
  timings: AnimateTimings;
  animation: AnimationMetadata | AnimationMetadata[];
}

// --- Builders -----------------------------------------------------------

/**
 * Contenedor con nombre. `name` es lo que el template referencia como
 * `[@name]`. Adentro van `state(...)` y `transition(...)`.
 */
export function trigger(name: string, definitions: AnimationMetadata[]): AnimationTriggerMetadata {
  return { type: AnimationMetadataType.Trigger, name, definitions, options: {} };
}

/**
 * La transición temporal: `timings` (duración + delay + easing) y el `style`
 * (o `keyframes`) destino. Sin `styles` toma el `style` de un `state`/`transition`
 * vecino.
 */
export function animate(
  timings: AnimateTimings,
  styles: AnimationStyleMetadata | AnimationKeyframesSequenceMetadata | null = null,
): AnimationAnimateMetadata {
  return { type: AnimationMetadataType.Animate, styles, timings };
}

/** Corre sus pasos **en paralelo**. */
export function group(steps: AnimationMetadata[], options: AnimationOptions | null = null): AnimationGroupMetadata {
  return { type: AnimationMetadataType.Group, steps, options };
}

/** Corre sus pasos **en orden**, uno tras otro. */
export function sequence(
  steps: AnimationMetadata[],
  options: AnimationOptions | null = null,
): AnimationSequenceMetadata {
  return { type: AnimationMetadataType.Sequence, steps, options };
}

/** Un set de propiedades CSS. Building block de `state`/`animate`/`keyframes`. */
export function style(tokens: AnimationStyleTokens): AnimationStyleMetadata {
  return { type: AnimationMetadataType.Style, styles: tokens, offset: null };
}

/** Cómo se ve el elemento **en reposo** cuando el trigger vale `name`. */
export function state(
  name: string,
  styles: AnimationStyleMetadata,
  options?: { params: { [name: string]: unknown } },
): AnimationStateMetadata {
  return { type: AnimationMetadataType.State, name, styles, options };
}

/** Fotogramas intermedios dentro de un `animate`, con `offset` 0→1. */
export function keyframes(steps: AnimationStyleMetadata[]): AnimationKeyframesSequenceMetadata {
  return { type: AnimationMetadataType.Keyframes, steps };
}

/** Qué animación correr al pasar el trigger de un estado a otro (`expr`). */
export function transition(
  stateChangeExpr: TransitionExpr,
  steps: AnimationMetadata | AnimationMetadata[],
  options: AnimationOptions | null = null,
): AnimationTransitionMetadata {
  return { type: AnimationMetadataType.Transition, expr: stateChangeExpr, animation: steps, options };
}

/** Define una animación reutilizable con parámetros; se invoca con `useAnimation`. */
export function animation(
  steps: AnimationMetadata | AnimationMetadata[],
  options: AnimationOptions | null = null,
): AnimationReferenceMetadata {
  return { type: AnimationMetadataType.Reference, animation: steps, options };
}

/** Deja correr la animación de un componente hijo en el momento que el padre decide. */
export function animateChild(options: AnimateChildOptions | null = null): AnimationAnimateChildMetadata {
  return { type: AnimationMetadataType.AnimateChild, options };
}

/** Invoca una animación reutilizable creada con `animation()`, opcionalmente con `params`. */
export function useAnimation(
  animation: AnimationReferenceMetadata,
  options: AnimationOptions | null = null,
): AnimationAnimateRefMetadata {
  return { type: AnimationMetadataType.AnimateRef, animation, options };
}

/** Selecciona sub-elementos del host y les aplica una animación. Soporta `:enter`/`:leave`. */
export function query(
  selector: string,
  animation: AnimationMetadata | AnimationMetadata[],
  options: AnimationQueryOptions | null = null,
): AnimationQueryMetadata {
  return { type: AnimationMetadataType.Query, selector, animation, options };
}

/** Dentro de un `query`, desfasa el arranque de cada elemento (efecto cascada). */
export function stagger(
  timings: AnimateTimings,
  animation: AnimationMetadata | AnimationMetadata[],
): AnimationStaggerMetadata {
  return { type: AnimationMetadataType.Stagger, timings, animation };
}
