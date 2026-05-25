import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { homedir } from "node:os";
import { join } from "node:path";
import { ensureServer, shutdownServer, type ServerHandle } from "./server.ts";
import { MnemClient } from "./client.ts";
import { TOOLS } from "./tools/shared.ts";
import * as local from "./tools/local.ts";
import { resolveClient } from "./routing.ts";
import { runIntegrate } from "./integrate.ts";

// ── Arg parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isIntegrate = args[0] === "integrate";
const debug = args.includes("--debug");
const mnemBin = (() => { const i = args.indexOf("--mnem-bin"); return i >= 0 ? args[i + 1] : "mnem"; })();

// ── Integrate mode ───────────────────────────────────────────────────────────

if (isIntegrate) {
  const binaryPath = Bun.which("mnem-http-mcp") ?? process.execPath;
  await runIntegrate(binaryPath, {
    claude: args.includes("--claude"),
    claudeDesktop: args.includes("--claude-desktop"),
    opencode: args.includes("--opencode"),
  });
  process.exit(0);
}

// ── Global server (always started at launch) ─────────────────────────────────

const globalRepoPath = join(homedir(), ".mnemglobal");

let globalHandle: ServerHandle;
try {
  globalHandle = await ensureServer(globalRepoPath, mnemBin, debug);
} catch (e) {
  console.error(`[mnem-http-mcp] Failed to start global server: ${e}`);
  process.exit(1);
}
const globalClient = new MnemClient(globalHandle.port, globalHandle.token);

// ── Per-call local server cache ───────────────────────────────────────────────

const serverCache = new Map<string, ServerHandle>();
const clientCache = new Map<string, MnemClient>();
const inFlight = new Map<string, Promise<MnemClient>>();

async function getLocalClient(repoPath: string): Promise<MnemClient> {
  if (clientCache.has(repoPath)) return clientCache.get(repoPath)!;
  if (inFlight.has(repoPath)) return inFlight.get(repoPath)!;
  const p = (async () => {
    const handle = await ensureServer(repoPath, mnemBin, debug);
    serverCache.set(repoPath, handle);
    const client = new MnemClient(handle.port, handle.token);
    clientCache.set(repoPath, client);
    return client;
  })();
  p.finally(() => inFlight.delete(repoPath));
  inFlight.set(repoPath, p);
  return p;
}

// ── Shutdown handler ─────────────────────────────────────────────────────────

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  shutdownServer(globalHandle, globalRepoPath);
  for (const [path, handle] of serverCache) shutdownServer(handle, path);
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.stdin.on("close", shutdown);
process.stdin.on("end", shutdown);

// ── MCP server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: "mnem-http-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: a } = request.params;
  const callArgs = (a ?? {}) as Record<string, unknown>;

  try {
    const { client, repoPath } = await resolveClient(callArgs, globalRepoPath, globalClient, getLocalClient);
    let text: string;

    switch (name) {
      case "mnem_stats":               text = await local.mnem_stats(callArgs, client); break;
      case "mnem_schema":              text = await local.mnem_schema(callArgs, client, mnemBin, repoPath); break;
      case "mnem_recent":              text = await local.mnem_recent(callArgs, client); break;
      case "mnem_list_tags":           text = await local.mnem_list_tags(callArgs, client); break;
      case "mnem_list_nodes":          text = await local.mnem_list_nodes(callArgs, client); break;
      case "mnem_search":              text = await local.mnem_search(callArgs, client); break;
      case "mnem_get_node":            text = await local.mnem_get_node(callArgs, client); break;
      case "mnem_retrieve":            text = await local.mnem_retrieve(callArgs, client); break;
      case "mnem_vector_search":       text = await local.mnem_vector_search(callArgs, client, mnemBin, repoPath); break;
      case "mnem_commit":              text = await local.mnem_commit(callArgs, client); break;
      case "mnem_commit_relation":     text = await local.mnem_commit_relation(callArgs, client); break;
      case "mnem_resolve_or_create":   text = await local.mnem_resolve_or_create(callArgs, client); break;
      case "mnem_tombstone_node":      text = await local.mnem_tombstone_node(callArgs, client); break;
      case "mnem_delete_node":         text = await local.mnem_delete_node(callArgs, client); break;
      case "mnem_traverse":            text = await local.mnem_traverse(callArgs, client, mnemBin, repoPath); break;
      case "mnem_incoming_edges":      text = await local.mnem_incoming_edges(callArgs, client, mnemBin, repoPath); break;
      case "mnem_ingest":              text = await local.mnem_ingest(callArgs, client); break;
      case "mnem_community_summarize": text = await local.mnem_community_summarize(callArgs, client, mnemBin, repoPath); break;
      default: throw new Error(`Unknown tool: ${name}`);
    }

    if (debug) console.error(`[mnem-http-mcp] ${name} OK`);
    return { content: [{ type: "text", text }] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (debug) console.error(`[mnem-http-mcp] ${name} ERROR: ${msg}`);
    return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
