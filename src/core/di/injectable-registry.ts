const injectableIds = new WeakMap<object, string>();

export function setInjectableId(target: object, id: string): void {
  injectableIds.set(target, id);
}

export function getInjectableId(target: object): string | undefined {
  return injectableIds.get(target);
}

/**
 * Deriva un `$name` estable para un `@Injectable()` sin `id` explícito: la
 * identidad es la clase (como en Angular real), y el nombre sale de `Clase.name`
 * con un sufijo incremental si dos clases distintas colisionan. Clase (no un
 * contador suelto) para poder resetear en tests.
 *
 * Nota: `Clase.name` se manglea en build minificado — para nombres 100% estables
 * pasá `@Injectable({ id: "..." })`. A futuro lo resuelve el transform.
 */
class InjectableNameRegistry {
  private readonly byClass = new WeakMap<Function, string>();
  private readonly used = new Map<string, number>();

  nameFor(target: Function): string {
    const cached = this.byClass.get(target);
    if (cached) return cached;

    const base = target.name || "Injectable";
    const seen = this.used.get(base) ?? 0;
    this.used.set(base, seen + 1);
    const name = seen === 0 ? base : `${base}_${seen}`;
    this.byClass.set(target, name);
    return name;
  }
}

const injectableNames = new InjectableNameRegistry();

export function deriveInjectableName(target: Function): string {
  return injectableNames.nameFor(target);
}
