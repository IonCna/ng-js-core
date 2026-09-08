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
  // `ngDoCheck` → `ngAfterContentChecked` → `ngAfterViewChecked` corren, en ese
  // orden, en cada ciclo de detección de cambios de Angular. AngularJS solo tiene
  // `$doCheck` (una vez por digest): los tres se encadenan ahí. Encadenado (no
  // "si no existe") para no pisar un `$doCheck` que ya haya puesto el autor.
  const perDigestHooks = [inst.ngDoCheck, inst.ngAfterContentChecked, inst.ngAfterViewChecked].filter(
    (hook): hook is () => void => typeof hook === "function",
  );
  for (const hook of perDigestHooks) {
    chainInstanceMethod(inst as object, "$doCheck", () => hook.call(inst));
  }
  if (typeof inst.ngAfterContentInit === "function" || typeof inst.ngAfterViewInit === "function") {
    // `ngAfterContentInit` en `$postLink`: el contenido proyectado ya está
    // linkeado ahí. `ngAfterViewInit`, en cambio, se difiere a `$$postDigest`
    // (Gap D): en Angular corre DESPUÉS de que la vista propia (incl.
    // `ng-repeat`/estructurales del template) renderizó — y en AngularJS eso
    // pasa recién al terminar el primer `$digest`, no en `$postLink`. Se
    // mantiene el orden de Angular (content antes que view).
    // Encadenado (no "si no existe"): así no pisa un `$postLink` ya puesto por
    // otro bridge (ej. `ng-ref-bridge.ts`) ni por el autor.
    chainInstanceMethod(inst as object, "$postLink", () => {
      inst.ngAfterContentInit?.();
      if (typeof inst.ngAfterViewInit !== "function") return;
      if (typeof $scope?.$$postDigest === "function") {
        $scope.$$postDigest(() => inst.ngAfterViewInit?.());
      } else {
        inst.ngAfterViewInit();
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
