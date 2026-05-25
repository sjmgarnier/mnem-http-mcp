import type { MnemClient } from "../client.ts";

type Args = Record<string, unknown>;

export async function mnem_global_retrieve(args: Args, globalClient: MnemClient): Promise<string> {
  const body: Record<string, unknown> = {};
  if (args.text) body.text = args.text;
  if (args.limit) body.limit = args.limit;
  if (args.token_budget) body.token_budget = args.token_budget;
  if (args.vector) body.vector = args.vector;
  return JSON.stringify(await globalClient.retrieve(body as any), null, 2);
}

export async function mnem_global_add(args: Args, globalClient: MnemClient): Promise<string> {
  const author = String(args.agent_id);
  const message = args.message ? String(args.message) : undefined;
  const nodes = (args.nodes as any[] ?? []);
  const edges = (args.edges as any[] ?? []);
  const results: unknown[] = [];

  if (nodes.length === 1) {
    const n = nodes[0];
    results.push(await globalClient.postNode({ label: n.ntype, summary: n.summary, props: n.props, author, message }));
  } else if (nodes.length > 1) {
    results.push(await globalClient.postNodesBulk(nodes.map((n: any) => ({ label: n.ntype, summary: n.summary, props: n.props, author, message }))));
  }
  for (const e of edges) {
    results.push(await globalClient.postEdge({ src: e.from ?? e.src, dst: e.to ?? e.dst, label: e.predicate ?? e.label, props: e.props, author, message }));
  }

  return JSON.stringify(results, null, 2);
}

export async function mnem_global_ingest(args: Args, globalClient: MnemClient): Promise<string> {
  return JSON.stringify(await globalClient.ingest(args as any), null, 2);
}

export async function mnem_global_tombstone_node(args: Args, globalClient: MnemClient): Promise<string> {
  return JSON.stringify(
    await globalClient.tombstoneNode(String(args.id), String(args.agent_id), args.reason ? String(args.reason) : undefined),
    null, 2
  );
}
