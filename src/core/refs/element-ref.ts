import { Injectable } from "@/core/di/injectable.ts";

/**
 * El elemento host. No es un servicio: los bridges de `ngjs-core` lo agregan a los `locals` de cada controller
 * (por instancia) bajo su nombre de DI compilado (`ɵprov.token`, por eso `@Injectable()`).
 */
@Injectable()
export abstract class ElementRef<T = Element> {
  abstract readonly nativeElement: T;
}

export class ElementRefImpl<T = Element> extends ElementRef<T> {
  constructor(public readonly nativeElement: T) {
    super();
  }
}
