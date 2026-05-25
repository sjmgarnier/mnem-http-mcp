import { walkUp } from "./server.ts";
import type { MnemClient } from "./client.ts";

export type GetLocalClient = (repoPath: string) => Promise<MnemClient>;

export async function resolveClient(
  args: Record<string, unknown>,
  globalRepoPath: string,
  globalClient: MnemClient,
  getLocalClient: GetLocalClient,
): Promise<{ client: MnemClient; repoPath: string }> {
  const hasGlobal = args.global === true;
  const hasRepo = typeof args.repo === "string";

  if (!hasGlobal && !hasRepo) {
    throw new Error(
      'Routing required: pass "global": true or "repo": "<project-dir>" in every tool call.'
    );
  }

  if (hasRepo) {
    if (hasGlobal) {
      console.error('[mnem-http-mcp] WARNING: both "global" and "repo" provided; ignoring "global", using "repo".');
    }
    const resolved = walkUp(args.repo as string);
    if (!resolved) {
      throw new Error(`No .mnem graph found at or above: ${args.repo}`);
    }
    const client = await getLocalClient(resolved);
    return { client, repoPath: resolved };
  }

  return { client: globalClient, repoPath: globalRepoPath };
}
