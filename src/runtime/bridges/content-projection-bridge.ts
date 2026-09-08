import type angular from "angular";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import {
  bindContentQueryOwners,
  getScopeViewQueryRegistries,
  runWithContentQueryOwners,
} from "@/core/queries/query-context.ts";
import { chainInstanceMethod, decorateControllerWith } from "@/runtime/bridges/shared.ts";

/**
 * Clave en `$element.data()` del host de un `@Component` donde queda su
 * contenido proyectado — ya transcluido y linkeado. `<ng-content>` lo lee para
 * MOVER esos nodos a su posición en vez de transcluir él (ver `ng-content.ts`).
 */
export const CONTENT_PROJECTION_KEY = "$ngjsContentProjection";

export interface ContentProjection {
  /** Nodos raíz del contenido proyectado, ya linkeados (o `undefined` si el uso no tenía contenido). */
  clone?: angular.IAugmentedJQuery;
  /** `true` cuando un `<ng-content>` ya insertó estos nodos en el DOM. */
  consumed: boolean;
}

/**
 * Opción 2 — proyección EAGER, como Angular real.
 *
 * En Angular el contenido proyectado de un componente se **instancia siempre**
 * (constructores + ciclo de vida), exista o no un `<ng-content>`; `<ng-content>`
 * solo decide DÓNDE se muestra. AngularJS es al revés: el contenido transcluido
 * se linkea recién cuando alguien invoca `$transclude()` (lo hacía `<ng-content>`
 * en su `$postLink`), así que un `@Component` sin `<ng-content>` nunca veía sus
 * `@ContentChild(ren)`.
 *
 * Este bridge transcluye y linkea el contenido al construir CADA `@Component`
 * con `transclude`, deja el clone en `$element.data(CONTENT_PROJECTION_KEY)`, y
 * `<ng-content>` pasa a solo mover ese clone (con fallback al camino viejo si no
 * hay proyección). Corre después de `ng-ref-bridge` para que el
 * `ViewQueryRegistry` del componente ya exista y reciba los candidatos.
 */
export function decorateControllerContentProjection(
  $delegate: angular.IControllerService,
): angular.IControllerService {
  return decorateControllerWith($delegate, {
    onInstance: (instance, locals) => {
      if (!instance || typeof instance !== "object") return;

      const Clase = (instance as { constructor: Function }).constructor;
      if (!getComponentDef(Clase)) return; // solo `@Component` (una `@Directive` sin template usa light DOM)

      const $transclude = locals?.$transclude as angular.ITranscludeFunction | undefined;
      const $element = locals?.$element as angular.IAugmentedJQuery | undefined;
      const $scope = locals?.$scope as angular.IScope | undefined;
      if (typeof $transclude !== "function" || !$element || !$scope) return;

      if ($element.data(CONTENT_PROJECTION_KEY)) return; // defensivo

      // Solo se hace proyección eager si ESTE componente tiene `@ContentChild(ren)`.
      // Un `@Component` con `<ng-content>` pero SIN content queries no la necesita:
      // `<ng-content>` con su transclusión lazy anda igual, y forzar la eager
      // linkearía el contenido detached (regresión con directivas que miden el DOM
      // al linkear, ej. `NgbProgressbarStacked`). `ng-ref-bridge` (registrado
      // antes) ya instaló las queries, así que `hasContentQueries` es fiable acá.
      const hasContentQueries = getScopeViewQueryRegistries($scope).some((registry) => registry.hasContentQueries);
      if (!hasContentQueries) return;

      const projection: ContentProjection = { consumed: false };
      $element.data(CONTENT_PROJECTION_KEY, projection);

      // `$onInit`: después de construir y de los bindings iniciales, antes de
      // linkear el template (y por lo tanto antes del `<ng-content>` de adentro).
      chainInstanceMethod(instance, "$onInit", () => {
        // Gap C: SOLO los registries de ESTE componente — no los heredados
        // (`getContentQueryOwners`). Un `@Component` anidado bindea su propio
        // registry; el contenido escrito entre sus tags es SUYO, no del
        // componente de afuera — como en Angular, donde `@ContentChildren` no ve
        // el contenido de un componente hijo (la re-proyección real por
        // `<ng-content>` sigue en `ng-content.ts` vía `getContentQueryOwners`).
        const owners = getScopeViewQueryRegistries($scope).filter((registry) => registry.hasContentQueries);

        runWithContentQueryOwners(owners, () => {
          $transclude((clone, transcludedScope) => {
            projection.clone = clone as angular.IAugmentedJQuery | undefined;
            const rootNodes = clone ? (Array.from(clone) as Node[]) : [];
            for (const owner of owners) owner.registerContentRoots(rootNodes);
            if (transcludedScope) bindContentQueryOwners(transcludedScope, owners);
          });
        });
      });
    },
  });
}
decorateControllerContentProjection.$inject = ["$delegate"];
