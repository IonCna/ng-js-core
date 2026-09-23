import type angular from "angular";
import type { AbstractControl } from "@/forms/abstract-control.ts";

/**
 * Key propia de `$element.data()`/`inheritedData()` — mismo mecanismo que
 * `ElementInjectorNode` (`scoped-injector-bridge.ts`, key `$ngjsInjector`) y
 * `ViewContainerRef` (`view-container-ref-bridge.ts`): cualquier elemento con
 * un `[formGroup]`/`formArrayName` publica el control acá, y sus descendientes
 * lo resuelven subiendo por el DOM con `inheritedData` — sin depender de
 * `require: '^^nombre'` de AngularJS, que no sirve para "el más cercano de
 * cualquiera de estas dos directivas distintas" (`[formGroup]` en la raíz,
 * `formArrayName` anidado más abajo).
 */
const CONTROL_CONTAINER_DATA_KEY = "$ngjsControlContainer";

export function publishControlContainer($element: angular.IAugmentedJQuery, control: AbstractControl): void {
  $element.data(CONTROL_CONTAINER_DATA_KEY, control);
}

/**
 * Sube por el DOM buscando el `[formGroup]`/`formArrayName` ancestro más
 * cercano. Si el propio `$element` ya publicó un container (caso
 * `formArrayName`, que resuelve el SUYO antes de publicarse a sí mismo), hay
 * que llamar esto ANTES de `publishControlContainer` — si no, se encontraría
 * a sí mismo.
 */
export function findAncestorControl($element: angular.IAugmentedJQuery): AbstractControl | null {
  return ($element.inheritedData(CONTROL_CONTAINER_DATA_KEY) as AbstractControl | undefined) ?? null;
}
