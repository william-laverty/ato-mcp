import { describe, it, expect } from "vitest";
import { render, within } from "@testing-library/react";
import React from "react";
import { CorpusFlow } from "@/components/site/CorpusFlow";

describe("CorpusFlow", () => {
  it("renders all four acts' copy in the steps region", () => {
    const steps = within(render(<CorpusFlow />).getByTestId("corpus-flow-steps"));
    expect(steps.getByText(/Everything the ATO publishes/)).toBeInTheDocument();
    expect(steps.getByText(/Brought together and cross-linked/)).toBeInTheDocument();
    expect(steps.getByText(/Plug it into Claude/)).toBeInTheDocument();
    expect(steps.getByText(/Ask in plain English/)).toBeInTheDocument();
  });

  it("renders the corpus numbers as static step text", () => {
    const steps = within(render(<CorpusFlow />).getByTestId("corpus-flow-steps"));
    expect(steps.getByText("224,585")).toBeInTheDocument();
    expect(steps.getByText("4,638")).toBeInTheDocument();
    expect(steps.getByText("23,267")).toBeInTheDocument();
  });

  it("renders the connect fragment and citation chips", () => {
    const steps = within(render(<CorpusFlow />).getByTestId("corpus-flow-steps"));
    expect(steps.getByText("npx -y ato-mcp")).toBeInTheDocument();
    expect(steps.getByText("ITAA s 8-1")).toBeInTheDocument();
    expect(steps.getByText("TR 93/30")).toBeInTheDocument();
  });

  it("marks the decorative visual aria-hidden", () => {
    const { container } = render(<CorpusFlow />);
    const visual = container.querySelector(".corpus-visual");
    expect(visual).not.toBeNull();
    expect(visual?.getAttribute("aria-hidden")).toBe("true");
  });
});
