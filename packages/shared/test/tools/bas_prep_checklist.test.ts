import { describe, it, expect } from "vitest";
import { mapGstPeriod, quarterlyDueDate, dueDateFor, formFor, periodLabel } from "../../src/tools/bas_prep_checklist.js";

describe("period helpers", () => {
  it("mapGstPeriod", () => {
    expect(mapGstPeriod("quarterly")).toBe("quarterly");
    expect(mapGstPeriod("monthly")).toBe("monthly");
    expect(mapGstPeriod("annual")).toBe("annual");
    expect(mapGstPeriod("n/a")).toBe("none");
  });
  it("quarterlyDueDate maps each quarter for FY2025-26", () => {
    expect(quarterlyDueDate(1, "2025-26")).toBe("2025-10-28");
    expect(quarterlyDueDate(2, "2025-26")).toBe("2026-02-28");
    expect(quarterlyDueDate(3, "2025-26")).toBe("2026-04-28");
    expect(quarterlyDueDate(4, "2025-26")).toBe("2026-07-28");
  });
  it("dueDateFor returns the quarterly date only when quarterly + quarter given", () => {
    expect(dueDateFor("quarterly", 2, "2025-26")).toBe("2026-02-28");
    expect(dueDateFor("quarterly", undefined, "2025-26")).toBeNull();
    expect(dueDateFor("monthly", undefined, "2025-26")).toBeNull();
    expect(dueDateFor("annual", undefined, "2025-26")).toBeNull();
  });
  it("formFor", () => {
    expect(formFor("monthly")).toMatch(/monthly/i);
    expect(formFor("quarterly")).toMatch(/quarterly/i);
    expect(formFor("annual")).toMatch(/annual/i);
    expect(formFor("none")).toMatch(/IAS|instalment/i);
  });
  it("periodLabel", () => {
    expect(periodLabel("quarterly", 2, "2025-26")).toMatch(/Q2/);
    expect(periodLabel("monthly", undefined, "2025-26")).toMatch(/monthly/i);
  });
});
