import { Directive } from "@/core/metadata/directive.ts";
import { HostBinding } from "@/core/metadata/host-binding.ts";
import { Input } from "@/core/metadata/input.ts";

/*
 * Las `ng-*` de atributos nativos que AngularJS no trae (`ng-disabled`, `ng-readonly`, … sí las trae): enlazan una
 * expresión con el atributo, como `[hidden]`/`[id]`/`[title]` en Angular. `ng-js-compiler` registra con ellas los
 * inputs de esos nombres (`@Input() hidden` → `'<?ngHidden'`) y `ng-js-template-compiler` traduce `hidden="x"` →
 * `ng-hidden="x"`. Las declara `CoreModule`.
 */

/** `ng-hidden="x"`: el atributo `hidden` real (no la clase `ng-hide`). */
@Directive({ selector: "[ngHidden]" })
export class NgHidden {
  @Input() ngHidden: unknown;

  @HostBinding("attr.hidden")
  get _hidden(): string | null {
    return this.ngHidden ? "" : null;
  }
}

/** `ng-id="x"`: el `id` del elemento; `null`/`undefined` lo saca. */
@Directive({ selector: "[ngId]" })
export class NgId {
  @Input() ngId: unknown;

  @HostBinding("attr.id")
  get _id(): string | null {
    return this.ngId === null || this.ngId === undefined ? null : String(this.ngId);
  }
}

/** `ng-title="x"`: el `title` del elemento; `null`/`undefined` lo saca. */
@Directive({ selector: "[ngTitle]" })
export class NgTitle {
  @Input() ngTitle: unknown;

  @HostBinding("attr.title")
  get _title(): string | null {
    return this.ngTitle === null || this.ngTitle === undefined ? null : String(this.ngTitle);
  }
}
