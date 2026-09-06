import { describe, expect, it } from "vitest";
import {
  AnimationMetadataType,
  animate,
  animateChild,
  animation,
  group,
  keyframes,
  query,
  sequence,
  stagger,
  state,
  style,
  transition,
  trigger,
  useAnimation,
} from "@/animations/index.ts";

describe("etapa 17 — DSL builders", () => {
  it("cada builder emite el `type` entero de @angular/animations", () => {
    expect(style({ opacity: 0 }).type).toBe(AnimationMetadataType.Style);
    expect(animate("300ms").type).toBe(AnimationMetadataType.Animate);
    expect(state("abierto", style({})).type).toBe(AnimationMetadataType.State);
    expect(transition("a => b", []).type).toBe(AnimationMetadataType.Transition);
    expect(keyframes([]).type).toBe(AnimationMetadataType.Keyframes);
    expect(trigger("t", []).type).toBe(AnimationMetadataType.Trigger);
    expect(group([]).type).toBe(AnimationMetadataType.Group);
    expect(sequence([]).type).toBe(AnimationMetadataType.Sequence);
    expect(animation([]).type).toBe(AnimationMetadataType.Reference);
    expect(animateChild().type).toBe(AnimationMetadataType.AnimateChild);
    expect(useAnimation(animation([])).type).toBe(AnimationMetadataType.AnimateRef);
    expect(query(":enter", []).type).toBe(AnimationMetadataType.Query);
    expect(stagger("50ms", []).type).toBe(AnimationMetadataType.Stagger);
  });

  it("`trigger` guarda name + definitions y arranca con `options: {}`", () => {
    const abierto = state("abierto", style({ height: "*" }));
    const t = trigger("panel", [abierto]);
    expect(t).toEqual({
      type: AnimationMetadataType.Trigger,
      name: "panel",
      definitions: [abierto],
      options: {},
    });
  });

  it("`style` normaliza a `{ styles, offset: null }`", () => {
    expect(style({ opacity: 0, height: "0px" })).toEqual({
      type: AnimationMetadataType.Style,
      styles: { opacity: 0, height: "0px" },
      offset: null,
    });
    // El token `"*"` (valor computado) pasa tal cual.
    expect(style("*").styles).toBe("*");
  });

  it("`animate` acepta timings string o número y `styles` opcional (default null)", () => {
    expect(animate("300ms ease-in")).toEqual({
      type: AnimationMetadataType.Animate,
      timings: "300ms ease-in",
      styles: null,
    });
    const dest = style({ opacity: 1 });
    expect(animate(300, dest)).toEqual({ type: AnimationMetadataType.Animate, timings: 300, styles: dest });
  });

  it("`transition` guarda la expr en `.expr` y los pasos en `.animation`", () => {
    const steps = [style({ opacity: 0 }), animate("300ms", style({ opacity: 1 }))];
    const tr = transition(":enter", steps);
    expect(tr.expr).toBe(":enter");
    expect(tr.animation).toBe(steps);
    expect(tr.options).toBeNull();
  });

  it("`transition` acepta un predicado como expr", () => {
    const pred = (from: string, to: string) => from === "void" && to === "abierto";
    expect(transition(pred, []).expr).toBe(pred);
  });

  it("`keyframes` guarda los pasos en `.steps` (sin `options`)", () => {
    const frames = [style({ offset: 0, opacity: 0 }), style({ offset: 1, opacity: 1 })];
    expect(keyframes(frames)).toEqual({ type: AnimationMetadataType.Keyframes, steps: frames });
  });

  it("`group` / `sequence` guardan `.steps` + `.options` (default null)", () => {
    const steps = [animate("100ms"), animate("200ms")];
    expect(group(steps)).toEqual({ type: AnimationMetadataType.Group, steps, options: null });
    expect(sequence(steps, { delay: 100 })).toEqual({
      type: AnimationMetadataType.Sequence,
      steps,
      options: { delay: 100 },
    });
  });

  it("`animation` + `useAnimation` arman el par reusable", () => {
    const fadeIn = animation([style({ opacity: 0 }), animate("{{ time }}", style({ opacity: 1 }))]);
    expect(fadeIn).toEqual({
      type: AnimationMetadataType.Reference,
      animation: fadeIn.animation,
      options: null,
    });
    const call = useAnimation(fadeIn, { params: { time: "300ms" } });
    expect(call).toEqual({
      type: AnimationMetadataType.AnimateRef,
      animation: fadeIn,
      options: { params: { time: "300ms" } },
    });
  });

  it("`query` guarda `.selector` + `.animation` + `.options` (default null)", () => {
    const anim = animate("300ms");
    expect(query(".item", anim)).toEqual({
      type: AnimationMetadataType.Query,
      selector: ".item",
      animation: anim,
      options: null,
    });
    expect(query(".item", anim, { optional: true, limit: 3 }).options).toEqual({ optional: true, limit: 3 });
  });

  it("`stagger` guarda `.timings` + `.animation` (sin `options`)", () => {
    const anim = [animate("300ms", style({ opacity: 1 }))];
    expect(stagger("50ms", anim)).toEqual({
      type: AnimationMetadataType.Stagger,
      timings: "50ms",
      animation: anim,
    });
  });

  it("`animateChild` default `options: null`", () => {
    expect(animateChild()).toEqual({ type: AnimationMetadataType.AnimateChild, options: null });
    expect(animateChild({ duration: "1s" }).options).toEqual({ duration: "1s" });
  });

  it("un `@Component({ animations })` completo se arma sin tocar runtime", () => {
    const anims = [
      trigger("panel", [
        state("cerrado", style({ height: "0px", opacity: 0 })),
        state("abierto", style({ height: "*", opacity: 1 })),
        transition("cerrado => abierto", animate("300ms ease-out")),
        transition("abierto => cerrado", animate("200ms ease-in")),
      ]),
    ];
    expect(anims[0].definitions).toHaveLength(4);
    expect(anims[0].definitions.map((d) => d.type)).toEqual([
      AnimationMetadataType.State,
      AnimationMetadataType.State,
      AnimationMetadataType.Transition,
      AnimationMetadataType.Transition,
    ]);
  });
});
