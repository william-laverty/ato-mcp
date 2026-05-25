import { describe, it, expect } from "vitest";
import { rrfFuse } from "@ato-pro/shared/lib/rrf";

describe("rrfFuse", () => {
  it("favours items that appear in both rankings", () => {
    // y appears in both lists; z only in one at a low rank
    const a = [{ id: "x" }, { id: "y" }, { id: "z" }];
    const b = [{ id: "y" }, { id: "w" }, { id: "z" }];
    const fused = rrfFuse([a, b], (item) => item.id, 60);
    expect(fused[0].id).toBe("y");
  });

  it("returns unique ids only", () => {
    const a = [{ id: "x" }, { id: "y" }];
    const b = [{ id: "x" }, { id: "z" }];
    const fused = rrfFuse([a, b], (item) => item.id, 60);
    const ids = fused.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("assigns higher score to lower ranks", () => {
    const a = [{ id: "x" }, { id: "y" }];
    const fused = rrfFuse([a], (item) => item.id, 60);
    expect(fused[0].score).toBeGreaterThan(fused[1].score);
  });
});
