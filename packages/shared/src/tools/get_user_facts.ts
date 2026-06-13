import type { UserFacts } from "../facts.js";

export interface GetUserFactsDeps {
  facts: UserFacts | null;
}

export interface GetUserFactsOutput {
  facts: UserFacts;
}

export async function getUserFacts(
  deps: GetUserFactsDeps,
  _args: object,
): Promise<GetUserFactsOutput> {
  if (!deps.facts) {
    throw new Error(
      "Personal facts not set. Complete onboarding at https://ato-mcp.com.au/onboard.",
    );
  }
  return { facts: deps.facts };
}
