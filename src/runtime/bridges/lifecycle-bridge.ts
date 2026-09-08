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
  $doCheck?(): void;
  ngAfterContentInit?(): void;
  ngAfterViewInit?(): void;
  $postLink?(): void;
}

function bridgeLifecycle(instance: unknown): void {
  const inst = instance as ControllerInstance | null | undefined;
  if (!inst) return;

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
