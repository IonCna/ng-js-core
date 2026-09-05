/**
 * Interfaces de ciclo de vida = solo tipos, se borran al compilar (ver
 * CONCEPTOS "Interfaces de ciclo de vida"). El bridge (`controller-bridge.ts`)
 * detecta el método por nombre (`ngOnInit`), no por `instanceof` — en JS se
 * escribe el método y listo, `implements OnInit` en TS es solo chequeo del
 * compilador.
 */
export interface OnInit {
  ngOnInit(): void;
}

export interface OnDestroy {
  ngOnDestroy(): void;
}

export interface DoCheck {
  ngDoCheck(): void;
}

/**
 * El objeto de cambios que arma AngularJS para `$onChanges` ya tiene esta
 * forma (`currentValue`/`previousValue`/`isFirstChange()`) — no hace falta
 * traducir nada, se reenvía tal cual.
 */
export interface SimpleChange<T = unknown> {
  readonly previousValue: T;
  readonly currentValue: T;
  isFirstChange(): boolean;
}

export type SimpleChanges = Record<string, SimpleChange>;

export interface OnChanges {
  ngOnChanges(changes: SimpleChanges): void;
}

/**
 * `brecha`: AngularJS no distingue "mi vista propia" de "contenido
 * transcluido" — los dos hooks de Angular colapsan en el mismo `$postLink`
 * (se pierde el orden entre uno y otro, y la separación).
 */
export interface AfterViewInit {
  ngAfterViewInit(): void;
}

export interface AfterContentInit {
  ngAfterContentInit(): void;
}
