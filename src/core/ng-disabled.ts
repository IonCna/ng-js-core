import { Injectable } from "@/core/di/injectable.ts";

/**
 * `NgDisabled` — token abstracto. Otra directiva/componente en el mismo elemento
 * hace `require: '?ngDisabled'` (o inyecta `NgDisabled`) para enterarse del
 * estado `disabled` sin reimplementar el watch booleano.
 *
 * La implementación y el decorador de la directiva nativa `ngDisabled` viven en
 * `@/native/bridges/ng-disabled-bridge.ts`; `inject(NgDisabled)` resuelve al controller de `ngDisabled` del mismo
 * elemento (un token de elemento, ver `ElementTokens`). Token de DI (`@Injectable()`, nombre compilado en `ɵprov`).
 */
@Injectable()
export abstract class NgDisabled {
  static readonly $name = "ngDisabled";

  abstract readonly disabled: boolean;
  abstract onChange(callback: (disabled: boolean) => void): () => void;
}
