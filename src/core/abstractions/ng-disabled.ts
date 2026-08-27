export abstract class NgDisabled {
  abstract readonly disabled: boolean;

  abstract onChange(callback: (disabled: boolean) => void): () => void;
}

export class NgDisabledImpl extends NgDisabled {
  private currentDisabled = false;
  private readonly listeners = new Set<(disabled: boolean) => void>();

  get disabled(): boolean {
    return this.currentDisabled;
  }

  onChange(callback: (disabled: boolean) => void): () => void {
    this.listeners.add(callback);

    return () => {
      this.listeners.delete(callback);
    };
  }

  setDisabled(disabled: boolean): void {
    if (disabled === this.currentDisabled) return;
    this.currentDisabled = disabled;

    for (const listener of this.listeners) {
      listener(disabled);
    }
  }
}
