export abstract class ElementRef<T = Element> {
  static readonly $name = "ElementRef";
  abstract readonly nativeElement: T;
}

export class ElementRefImpl<T = Element> extends ElementRef<T> {
  constructor(public readonly nativeElement: T) {
    super();
  }
}
