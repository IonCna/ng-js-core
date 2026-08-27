export abstract class NgDisabled {
  abstract readonly disabled: boolean;

  abstract onChange(
    callback: (disabled: boolean) => void,
  ): () => void;
}
