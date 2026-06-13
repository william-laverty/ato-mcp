import type { GetThresholdInput } from "../tools.js";
import type { Store } from "../store/types.js";

export interface GetThresholdDeps { store: Store | null }

export async function getThreshold(deps: GetThresholdDeps, args: GetThresholdInput) {
  if (!deps.store) throw new Error("Corpus unavailable. This is a server-side issue — please try again shortly.");
  const pit = args.pit ?? new Date().toISOString().slice(0, 10);
  const row = await deps.store.getThreshold(args.name, pit);
  if (!row) throw new Error(`Threshold not found: ${args.name} at ${pit}`);
  return row;
}
