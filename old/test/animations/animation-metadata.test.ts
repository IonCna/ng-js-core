import { describe, expect, it } from "vitest";
import { AnimationMetadataType } from "@/animations/index.ts";

describe("etapa 17 — AnimationMetadataType", () => {
  it("replica los valores numéricos de @angular/animations tal cual (0–12)", () => {
    // El CLI / un codemod comparan `node.type` contra estos enteros — no pueden derivar.
    expect({ ...AnimationMetadataType }).toMatchObject({
      State: 0,
      Transition: 1,
      Sequence: 2,
      Group: 3,
      Animate: 4,
      Keyframes: 5,
      Style: 6,
      Trigger: 7,
      Reference: 8,
      AnimateChild: 9,
      AnimateRef: 10,
      Query: 11,
      Stagger: 12,
    });
  });

  it("se exporta desde el barrel público", () => {
    expect(AnimationMetadataType.Trigger).toBe(7);
  });
});
