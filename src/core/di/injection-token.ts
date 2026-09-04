class InjectionTokenCounter {
  private static _count = 0;

  static get count() {
    return InjectionTokenCounter._count;
  }

  static increment() {
    InjectionTokenCounter._count++;
    return InjectionTokenCounter._count;
  }
}

export interface InjectionTokenOptions<T> {
  /** Se usa solo si nadie más provee el token — ver "el momento de hacer registry". */
  readonly factory: () => T;
}

export class InjectionToken<T> {
  private readonly _id: string;
  private declare readonly _type: T;
  readonly factory?: () => T;

  constructor(desc: string, options?: InjectionTokenOptions<T>) {
    this._id = `${desc}-${InjectionTokenCounter.increment()}`;
    this.factory = options?.factory;
  }

  toString() {
    return this._id;
  }
}
