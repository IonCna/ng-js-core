export abstract class ElementRef<T = any> {
  public abstract nativeElement: T
}

export class ElementRefImpl<T = any> extends ElementRef<T> {
  public nativeElement: T;

  constructor(nativeElement: T) {
    super();
    this.nativeElement = nativeElement;
  }
}
