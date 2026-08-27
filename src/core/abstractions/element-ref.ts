export abstract class ElementRef<T = any> {
  constructor(public nativeElement: T) {};
}

export class ElementRefImpl<T = any> extends ElementRef<T> {
  public nativeElement: T;

  constructor(nativeElement: T) {
    super(nativeElement);
    this.nativeElement = nativeElement;
  }
}
