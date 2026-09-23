export interface SimpleChange<T = unknown> {
  readonly previousValue: T;
  readonly currentValue: T;
  readonly firstChange: boolean;
  isFirstChange(): boolean;
}

export type SimpleChanges = Record<string, SimpleChange>;

export interface OnChanges {
  ngOnChanges(changes: SimpleChanges): void;
}

export interface OnInit {
  ngOnInit(): void;
}

export interface DoCheck {
  ngDoCheck(): void;
}

export interface AfterContentInit {
  ngAfterContentInit(): void;
}

export interface AfterContentChecked {
  ngAfterContentChecked(): void;
}

export interface AfterViewInit {
  ngAfterViewInit(): void;
}

export interface AfterViewChecked {
  ngAfterViewChecked(): void;
}

export interface OnDestroy {
  ngOnDestroy(): void;
}
