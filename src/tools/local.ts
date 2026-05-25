import type { MnemClient } from "../client.ts";

type Args = Record<string, unknown>;

function cliJson(mnemBin: string, repoPath: string, args: string[]): string {
  const res = Bun.spawnSync([mnemBin, ...args, "--repo", repoPath], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return res.stdout.toString() || res.stderr.toString();
}

export async function mnem_stats(args: Args, client: MnemClient): Promise<string> {
  return JSON.stringify(await client.stats(), null, 2);
}

export async function mnem_schema(args: Args, _client: MnemClient, mnemBin: string, repoPath: string): Promise<string> {
  return cliJson(mnemBin, repoPath, ["schema"]);
}

export async function mnem_recent(args: Args, client: MnemClient): Promise<string> {
  return JSON.stringify(await client.log(Number(args.limit ?? 20)), null, 2);
}

export async function mnem_list_tags(args: Args, client: MnemClient): Promise<string> {
  return JSON.stringify(await client.tags(), null, 2);
}

export async function mnem_list_nodes(args: Args, client: MnemClient): Promise<string> {
  const body: Record<string, unknown> = {};
  if (args.label) body.label = args.label;
  if (args.limit) body.limit = args.limit;
  return JSON.stringify(await client.retrieve(body as any), null, 2);
}

export async function mnem_search(args: Args, client: MnemClient): Promise<string> {
  const body: Record<string, unknown> = {};
  if (args.label) body.label = args.label;
  if (args.limit) body.limit = args.limit;
  if (args.where) body.where = args.where;
  if (args.with_outgoing) body.with_outgoing = args.with_outgoing;
  return JSON.stringify(await client.retrieve(body as any), null, 2);
}

export async function mnem_get_node(args: Args, client: MnemClient): Promise<string> {
  return JSON.stringify(await client.getNode(String(args.id)), null, 2);
}

export async function mnem_retrieve(args: Args, client: MnemClient): Promise<string> {
  return JSON.stringify(await client.retrieve(args as any), null, 2);
}

export async function mnem_vector_search(args: Args, _client: MnemClient, mnemBin: string, repoPath: string): Promise<string> {
  return cliJson(mnemBin, repoPath, ["query", "--vector", JSON.stringify(args.vector), "--model", String(args.model), "--limit", String(args.k ?? 10)]);
}

export async function mnem_commit(args: Args, client: MnemClient): Promise<string> {
  const author = String(args.agent_id);
  const message = args.message ? String(args.message) : undefined;
  const nodes = (args.nodes as any[] ?? []);
  const edges = (args.edges as any[] ?? []);
  const results: unknown[] = [];

  if (nodes.length === 1) {
    const n = nodes[0];
    results.push(await client.postNode({ label: n.ntype, summary: n.summary, props: n.props, author, message }));
  } else if (nodes.length > 1) {
    results.push(await client.postNodesBulk(nodes.map((n: any) => ({ label: n.ntype, summary: n.summary, props: n.props, author, message }))));
  }

  for (const e of edges) {
    results.push(await client.postEdge({ src: e.from ?? e.src, dst: e.to ?? e.dst, label: e.predicate ?? e.label, props: e.props, author, message }));
  }

  return JSON.stringify(results, null, 2);
}

export async function mnem_commit_relation(args: Args, client: MnemClient): Promise<string> {
  const author = String(args.agent_id ?? "mnem-http-mcp");
  const message = args.message ? String(args.message) : undefined;
  const anchor = String(args.anchor ?? "name");

  const subjectBody = {
    label: args.subject_kind ? String(args.subject_kind) : undefined,
    summary: String(args.subject),
    props: { [anchor]: args.subject, ...(args.subject_props as object ?? {}) },
    author,
    message,
  };
  const subjectResp = await client.postNode(subjectBody);

  const objectBody = {
    label: args.object_kind ? String(args.object_kind) : undefined,
    summary: String(args.object),
    props: { [anchor]: args.object, ...(args.object_props as object ?? {}) },
    author,
    message,
  };
  const objectResp = await client.postNode(objectBody);

  const edgeResp = await client.postEdge({
    src: subjectResp.id,
    dst: objectResp.id,
    label: String(args.predicate),
    props: args.edge_props as Record<string, unknown> | undefined,
    author,
    message,
  });

  return JSON.stringify({ subject: subjectResp, object: objectResp, edge: edgeResp }, null, 2);
}

export async function mnem_resolve_or_create(args: Args, client: MnemClient): Promise<string> {
  const author = String(args.agent_id ?? "mnem-http-mcp");
  const anchor = String(args.prop_name ?? "name");
  const nameVal = args.name ?? args.value;
  const label = String(args.label ?? args.kind ?? "");

  const lookupResult = await client.retrieve({ where: { [anchor]: nameVal }, label: label || undefined, limit: 1 });
  const hits = (lookupResult as any)?.nodes ?? (lookupResult as any)?.items ?? [];

  if (hits.length > 0) {
    return JSON.stringify(hits[0], null, 2);
  }

  const created = await client.postNode({
    label: label || undefined,
    summary: String(nameVal),
    props: { [anchor]: nameVal, ...(args.extra_props as object ?? {}) },
    author,
  });
  return JSON.stringify(created, null, 2);
}

export async function mnem_tombstone_node(args: Args, client: MnemClient): Promise<string> {
  return JSON.stringify(await client.tombstoneNode(String(args.id), String(args.agent_id), args.reason ? String(args.reason) : undefined), null, 2);
}

export async function mnem_delete_node(args: Args, client: MnemClient): Promise<string> {
  return JSON.stringify(await client.deleteNode(String(args.id), String(args.agent_id)), null, 2);
}

export async function mnem_traverse(args: Args, _client: MnemClient, mnemBin: string, repoPath: string): Promise<string> {
  const cliArgs = ["traverse", String(args.start), "--limit", String(args.limit ?? 25)];
  if (args.edge_labels) {
    for (const el of args.edge_labels as string[]) cliArgs.push("--edge-label", el);
  }
  return cliJson(mnemBin, repoPath, cliArgs);
}

export async function mnem_incoming_edges(args: Args, _client: MnemClient, mnemBin: string, repoPath: string): Promise<string> {
  const cliArgs = ["blame", String(args.node), "--limit", String(args.limit ?? 25)];
  if (args.etype) cliArgs.push("--edge-type", String(args.etype));
  if (args.json) cliArgs.push("--json");
  return cliJson(mnemBin, repoPath, cliArgs);
}

export async function mnem_ingest(args: Args, client: MnemClient): Promise<string> {
  return JSON.stringify(await client.ingest(args as any), null, 2);
}

export async function mnem_community_summarize(args: Args, _client: MnemClient, mnemBin: string, repoPath: string): Promise<string> {
  const ids = (args.node_ids as string[]).join(",");
  const cliArgs = ["community-summarize", "--nodes", ids];
  if (args.k) cliArgs.push("--k", String(args.k));
  if (args.query) cliArgs.push("--query", String(args.query));
  if (args.mmr_lambda !== undefined) cliArgs.push("--mmr-lambda", String(args.mmr_lambda));
  return cliJson(mnemBin, repoPath, cliArgs);
}
