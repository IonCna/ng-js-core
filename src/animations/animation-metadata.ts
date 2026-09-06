/**
 * Discriminante de todo nodo de metadata que producen los builders de la DSL
 * (`trigger`/`state`/`style`/`animate`/`transition`/`keyframes`/…).
 *
 * Los **valores numéricos son los de `@angular/animations` tal cual** (0–12): el
 * CLI / un codemod comparan `node.type` contra estos enteros, así que tienen que
 * matchear. Ver `docs/ORDEN-DE-CONSTRUCCION.md` etapa 17.
 *
 * `@angular/core` no depende de `@angular/animations`, por eso `@Component` tipa
 * `animations?: unknown[]` (opaco) y la DSL vive en este subpath aparte.
 */
export enum AnimationMetadataType {
  State = 0,
  Transition = 1,
  Sequence = 2,
  Group = 3,
  Animate = 4,
  Keyframes = 5,
  Style = 6,
  Trigger = 7,
  Reference = 8,
  AnimateChild = 9,
  AnimateRef = 10,
  Query = 11,
  Stagger = 12,
}
