import { describe, it, expect } from "vitest";
import { rrfFuse } from "../../src/lib/rrf.js";

interface Item {
  id: string;
}
const idOf = (x: Item) => x.id;

describe("rrfFuse", () => {
  it("fuses two rankings with equal weight by default", () => {
    const a: Item[] = [{ id: "x" }, { id: "y" }];
    const b: Item[] = [{ id: "y" }, { id: "z" }];
    const fused = rrfFuse([a, b], idOf, 60);
    // y appears in both lists → highest combined score
    expect(fused[0]!.id).toBe("y");
    expect(fused.map((f) => f.id)).toEqual(["y", "x", "z"]);
  });

  it("weights = all 1s matches unweighted scores exactly", () => {
    const a: Item[] = [{ id: "x" }, { id: "y" }];
    const b: Item[] = [{ id: "y" }, { id: "z" }];
    const plain = rrfFuse([a, b], idOf, 60);
    const weighted = rrfFuse([a, b], idOf, 60, [1, 1]);
    expect(weighted).toEqual(plain);
  });

  it("a heavier second ranking outranks the first", () => {
    const kw: Item[] = [{ id: "k1" }, { id: "k2" }];
    const vec: Item[] = [{ id: "v1" }, { id: "v2" }];
    // weight 3 on vec: v1 = 3/61 > k1 = 1/61
    const fused = rrfFuse([kw, vec], idOf, 60, [1, 3]);
    expect(fused[0]!.id).toBe("v1");
    expect(fused[1]!.id).toBe("v2"); // 3/62 > 1/61
  });

  it("missing weight entries default to 1", () => {
    const a: Item[] = [{ id: "x" }];
    const b: Item[] = [{ id: "y" }];
    const fused = rrfFuse([a, b], idOf, 60, [2]);
    expect(fused[0]!.id).toBe("x"); // 2/61 > 1/61
  });
});
