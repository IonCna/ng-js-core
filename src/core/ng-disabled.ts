/**
 * `NgDisabled` — token abstracto. Otra directiva/componente en el mismo elemento
 * hace `require: '?ngDisabled'` (o inyecta `NgDisabled`) para enterarse del
 * estado `disabled` sin reimplementar el watch booleano.
 *
 * La implementación y el decorador de la directiva nativa `ngDisabled` viven en
 * `@/runtime/bridges/ng-disabled-bridge.ts` — el CLI generaría ese wiring.
 */
export abstract class NgDisabled {
  static readonly $name = "ngDisabled";

  abstract readonly disabled: boolean;
  abstract onChange(callback: (disabled: boolean) => void): () => void;
}
