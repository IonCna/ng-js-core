import type angular from "angular";
import { chainInstanceMethod, decorateControllerWith } from "@/core/lifecycle/shared.ts";

interface ControllerInstance {
  ngOnInit?(): void;
  $onInit?(): void;
  ngOnChanges?(changes: unknown): void;
  $onChanges?(changes: unknown): void;
  ngOnDestroy?(): void;
  $onDestroy?(): void;
  ngDoCheck?(): void;
  $doCheck?(): void;
  ngAfterContentInit?(): void;
  ngAfterViewInit?(): void;
  $postLink?(): void;
}

function bridgeLifecycle(instance: unknown): void {
  const inst = instance as ControllerInstance | null | undefined;
  if (!inst) return;

  if (typeof inst.ngOnInit === "function" && typeof inst.$onInit !== "function") {
    inst.$onInit = () => inst.ngOnInit?.();
  }
  if (typeof inst.ngOnChanges === "function" && typeof inst.$onChanges !== "function") {
    inst.$onChanges = (changes: unknown) => inst.ngOnChanges?.(changes);
  }
  if (typeof inst.ngOnDestroy === "function" && typeof inst.$onDestroy !== "function") {
    inst.$onDestroy = () => inst.ngOnDestroy?.();
  }
  if (typeof inst.ngDoCheck === "function" && typeof inst.$doCheck !== "function") {
    inst.$doCheck = () => inst.ngDoCheck?.();
  }
  if (typeof inst.ngAfterContentInit === "function" || typeof inst.ngAfterViewInit === "function") {
    // brecha: AngularJS no distingue vista propia de contenido transcluido,
    // los dos colapsan en el mismo $postLink — se pierde el orden entre
    // ambos, pero respetamos el orden real de Angular (content antes que view).
    // Encadenado (no "si no existe"): así no pisa un $postLink ya puesto por
    // otro bridge (ej. ng-ref-bridge.ts) ni por el autor.
    chainInstanceMethod(inst as object, "$postLink", () => {
      inst.ngAfterContentInit?.();
      inst.ngAfterViewInit?.();
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
  return decorateControllerWith($delegate, { onInstance: (instance) => bridgeLifecycle(instance) });
}
decorateControllerLifecycle.$inject = ["$delegate"];
