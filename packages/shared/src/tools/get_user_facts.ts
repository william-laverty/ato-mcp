import type { UserFacts } from "../facts.js";

export interface GetUserFactsDeps {
  facts: UserFacts | null;
  fetchedFrom: "config_file" | "hosted_api";
  mode: "local" | "hosted";
}

export interface GetUserFactsOutput {
  facts: UserFacts;
  mode: "local" | "hosted";
  fetched_from: "config_file" | "hosted_api";
}

export async function getUserFacts(
  deps: GetUserFactsDeps,
  _args: object,
): Promise<GetUserFactsOutput> {
  if (!deps.facts) {
    throw new Error(
      "Personal facts not set. Run `ato-mcp onboard` to complete the web onboarding flow.",
    );
  }
  return { facts: deps.facts, mode: deps.mode, fetched_from: deps.fetchedFrom };
}
