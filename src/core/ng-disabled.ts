import { NgDisabled as AbstractNgDisabled } from "@/core/abstracts"
import type { IAttributes, IController, IDirective } from "angular"

export class NgDisabled extends AbstractNgDisabled implements IController {
    private currentDisabled = false
    private readonly listeners = new Set<(disabled: boolean) => void>()

    constructor(
        private readonly attrs: IAttributes
    ) {
        super();
    }

    $onInit(): void {
        this.attrs.$observe<boolean>("disabled", value => {
            this._update(value === true || String(value) === "disabled")
        })
    }

    get disabled() {
        return this.currentDisabled
    }

    onChange(callback: (disabled: boolean) => void): () => void {
        this.listeners.add(callback)

        return () => {
            this.listeners.delete(callback)
        }
    }

    private _update(disabled: boolean) {
        if(disabled === this.currentDisabled) return
        this.currentDisabled = disabled

        for(const listeners of this.listeners) {
            listeners(disabled)
        }
    }

    static get $inject() {
        return ["$attrs"]
    }

    static get $name() {
        return "ngDisabled"
    }

    static $factory(): IDirective {
        return {
            controller: NgDisabled,
            restrict: "A",
            bindToController: true,
            scope: false,
        }
    }
}

export function decorNgDisabled($delegate: IDirective[]) {
    for(const directive of $delegate) {
        directive.controller = NgDisabled
    }

    return $delegate
}
