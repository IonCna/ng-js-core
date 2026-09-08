import type angular from "angular";
import type { SimpleChanges } from "@/core/lifecycle/interfaces.ts";
import { withFirstChangeProperty } from "@/core/lifecycle/simple-changes.ts";
import { chainInstanceMethod, decorateControllerWith } from "@/runtime/bridges/shared.ts";

interface ControllerInstance {
  ngOnInit?(): void;
  $onInit?(): void;
  ngOnChanges?(changes: unknown): void;
  $onChanges?(changes: unknown): void;
  ngOnDestroy?(): void;
  $onDestroy?(): void;
  ngDoCheck?(): void;
  ngAfterContentChecked?(): void;
  ngAfterViewChecked?(): void;
  $doCheck?(): void;
  ngAfterContentInit?(): void;
  ngAfterViewInit?(): void;
  $postLink?(): void;
}

interface PostDigestScope extends angular.IScope {
  $$postDigest?(fn: () => void): void;
}

function bridgeLifecycle(instance: unknown, locals?: Record<string, unknown>): void {
  const inst = instance as ControllerInstance | null | undefined;
  if (!inst) return;
  const $scope = locals?.$scope as PostDigestScope | undefined;

  if (typeof inst.ngOnInit === "function") {
    // Un `$onInit` escrito por el autor (método en el prototipo) gana y anula
    // `ngOnInit` — si declaraste `$onInit` optaste por la semántica AngularJS.
    // Pero un `$onInit` que puso OTRO bridge como propiedad de instancia
    // (`output-emitter-bridge` corre antes y rescata los emitters `@Output`) NO
    // debe tapar `ngOnInit`: se encadena, y `ngOnInit` corre después del rescate.
    const authoredOnInit =
      typeof inst.$onInit === "function" && !Object.prototype.hasOwnProperty.call(inst, "$onInit");
    if (!authoredOnInit) {
      chainInstanceMethod(inst as object, "$onInit", () => inst.ngOnInit?.());
    }
  }
  if (typeof inst.ngOnChanges === "function" && typeof inst.$onChanges !== "function") {
    inst.$onChanges = (changes: unknown) => inst.ngOnChanges?.(withFirstChangeProperty(changes as SimpleChanges));
  }
  if (typeof inst.ngOnDestroy === "function" && typeof inst.$onDestroy !== "function") {
    inst.$onDestroy = () => inst.ngOnDestroy?.();
  }
  // Orden de Angular en cada CD: `ngDoCheck` → `ngAfterContentInit` (una vez) →
  // `ngAfterContentChecked` → `ngAfterViewInit` (una vez) → `ngAfterViewChecked`.
  // AngularJS solo tiene `$doCheck` (una vez por digest, y una llamada inicial
  // síncrona DENTRO del `nodeLinkFn`, ANTES del `$postLink`).
  //
  //  - `ngDoCheck` sí corre antes de `ngAfterContentInit` en Angular → se
  //    encadena a `$doCheck` sin gate.
  //  - `ngAfterContentChecked` NO puede correr antes de `ngAfterContentInit`
  //    (si no, un `this.contentChild.foo` en el checked explota, porque las
  //    queries se resuelven en el `$postLink`). Se gatea con un flag que se
  //    prende al correr el `Init`, y se dispara una vez ahí mismo (el "checked"
  //    del CD del init).
  //  - Ídem `ngAfterViewChecked` respecto de `ngAfterViewInit`.
  let contentInitDone = false;
  let viewInitDone = false;

  if (typeof inst.ngDoCheck === "function") {
    chainInstanceMethod(inst as object, "$doCheck", () => inst.ngDoCheck?.());
  }
  if (typeof inst.ngAfterContentChecked === "function") {
    chainInstanceMethod(inst as object, "$doCheck", () => {
      if (contentInitDone) inst.ngAfterContentChecked?.();
    });
  }
  if (typeof inst.ngAfterViewChecked === "function") {
    chainInstanceMethod(inst as object, "$doCheck", () => {
      if (viewInitDone) inst.ngAfterViewChecked?.();
    });
  }

  if (
    typeof inst.ngAfterContentInit === "function" ||
    typeof inst.ngAfterViewInit === "function" ||
    typeof inst.ngAfterContentChecked === "function" ||
    typeof inst.ngAfterViewChecked === "function"
  ) {
    // `ngAfterContentInit` en `$postLink`: el contenido proyectado ya está
    // linkeado y las queries resueltas ahí. `ngAfterViewInit`, en cambio, se
    // difiere a `$$postDigest` (Gap D): en Angular corre DESPUÉS de que la vista
    // propia (incl. `ng-repeat`/estructurales) renderizó — en AngularJS eso pasa
    // al terminar el primer `$digest`, no en `$postLink`.
    // Encadenado (no "si no existe"): no pisa un `$postLink` ya puesto por otro
    // bridge (`ng-ref-bridge.ts`) ni por el autor.
    chainInstanceMethod(inst as object, "$postLink", () => {
      inst.ngAfterContentInit?.();
      contentInitDone = true;
      inst.ngAfterContentChecked?.();

      const runViewInit = () => {
        inst.ngAfterViewInit?.();
        viewInitDone = true;
        inst.ngAfterViewChecked?.();
      };
      if (typeof $scope?.$$postDigest === "function") {
        $scope.$$postDigest(runViewInit);
      } else {
        runViewInit();
      }
    });
  }
}

/**
 * Decorador chico de `$controller` — reenvía los hooks 1-a-1 (`ngOnInit`,
 * `ngOnChanges`, `ngOnDestroy`, `ngDoCheck`, `ngAfterContentInit`/
 * `ngAfterViewInit` → `$postLink`), nada más (ni DI, ni hosts). Otras piezas
 * de etapa 5 son decoradores separados en este mismo directorio, apilados
 * sobre el mismo servicio.
 */
export function decorateControllerLifecycle($delegate: angular.IControllerService): angular.IControllerService {
  return decorateControllerWith($delegate, { onInstance: (instance, locals) => bridgeLifecycle(instance, locals) });
}
decorateControllerLifecycle.$inject = ["$delegate"];
