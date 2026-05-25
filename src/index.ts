import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { ensureServer, shutdownServer, type ServerHandle } from "./server.ts";
import { MnemClient } from "./client.ts";
import { LOCAL_TOOLS, GLOBAL_TOOLS } from "./tools/shared.ts";
import * as local from "./tools/local.ts";
import * as global_ from "./tools/global.ts";
import { runIntegrate } from "./integrate.ts";

// ── Arg parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isIntegrate = args[0] === "integrate";
const debug = args.includes("--debug");
const mnemBin = (() => { const i = args.indexOf("--mnem-bin"); return i >= 0 ? args[i + 1] : "mnem"; })();
const localRepoOverride = (() => { const i = args.indexOf("--local-repo"); return i >= 0 ? args[i + 1] : null; })();

// ── Integrate mode ───────────────────────────────────────────────────────────

if (isIntegrate) {
  const binaryPath = Bun.which("mnem-http-mcp") ?? process.execPath;
  await runIntegrate(binaryPath, {
    claude: args.includes("--claude"),
    opencode: args.includes("--opencode"),
  });
  process.exit(0);
}

// ── Local repo detection ─────────────────────────────────────────────────────

function walkUp(from: string): string | null {
  let current = from;
  while (true) {
    if (existsSync(join(current, ".mnem"))) return current;
    const parent = join(current, "..");
    if (parent === current) return null;
    current = parent;
  }
}

const localRepoPath = localRepoOverride ?? walkUp(process.cwd());
const globalRepoPath = join(homedir(), ".mnemglobal");

// ── Start servers ─────────────────────────────────────────────────────────────

const handles: Array<{ handle: ServerHandle; path: string }> = [];

let globalHandle!: ServerHandle;
let localHandle: ServerHandle | null = null;

try {
  globalHandle = await ensureServer(globalRepoPath, mnemBin, debug);
  handles.push({ handle: globalHandle, path: globalRepoPath });
} catch (e) {
  console.error(`[mnem-http-mcp] Failed to start global server: ${e}`);
  process.exit(1);
}

if (localRepoPath) {
  try {
    localHandle = await ensureServer(localRepoPath, mnemBin, debug);
    handles.push({ handle: localHandle, path: localRepoPath });
  } catch (e) {
    console.error(`[mnem-http-mcp] Failed to start local server: ${e}`);
  }
}

const globalClient = new MnemClient(globalHandle.port, globalHandle.token);
const localClient = localHandle ? new MnemClient(localHandle.port, localHandle.token) : null;

// ── Shutdown handler ─────────────────────────────────────────────────────────

function shutdown() {
  for (const { handle, path } of handles) shutdownServer(handle, path);
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ── MCP server ───────────────────────────────────────────────────────────────

const tools = [...GLOBAL_TOOLS, ...(localClient ? LOCAL_TOOLS : [])];

const server = new Server(
  { name: "mnem-http-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

function noLocalClient(): never {
  throw new Error("No local mnem graph found — run `mnem init` in your project directory");
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: a } = request.params;
  const callArgs = (a ?? {}) as Record<string, unknown>;

  try {
    let text: string;

    switch (name) {
      // ── Global ──
      case "mnem_global_retrieve":      text = await global_.mnem_global_retrieve(callArgs, globalClient); break;
      case "mnem_global_add":           text = await global_.mnem_global_add(callArgs, globalClient); break;
      case "mnem_global_ingest":        text = await global_.mnem_global_ingest(callArgs, globalClient); break;
      case "mnem_global_tombstone_node": text = await global_.mnem_global_tombstone_node(callArgs, globalClient); break;

      // ── Local ──
      case "mnem_stats":           text = await local.mnem_stats(callArgs, localClient ?? noLocalClient()); break;
      case "mnem_schema":          text = await local.mnem_schema(callArgs, localClient ?? noLocalClient(), mnemBin, localRepoPath!); break;
      case "mnem_recent":          text = await local.mnem_recent(callArgs, localClient ?? noLocalClient()); break;
      case "mnem_list_tags":       text = await local.mnem_list_tags(callArgs, localClient ?? noLocalClient()); break;
      case "mnem_list_nodes":      text = await local.mnem_list_nodes(callArgs, localClient ?? noLocalClient()); break;
      case "mnem_search":          text = await local.mnem_search(callArgs, localClient ?? noLocalClient()); break;
      case "mnem_get_node":        text = await local.mnem_get_node(callArgs, localClient ?? noLocalClient()); break;
      case "mnem_retrieve":        text = await local.mnem_retrieve(callArgs, localClient ?? noLocalClient()); break;
      case "mnem_vector_search":   text = await local.mnem_vector_search(callArgs, localClient ?? noLocalClient(), mnemBin, localRepoPath!); break;
      case "mnem_commit":          text = await local.mnem_commit(callArgs, localClient ?? noLocalClient()); break;
      case "mnem_commit_relation": text = await local.mnem_commit_relation(callArgs, localClient ?? noLocalClient()); break;
      case "mnem_resolve_or_create": text = await local.mnem_resolve_or_create(callArgs, localClient ?? noLocalClient()); break;
      case "mnem_tombstone_node":  text = await local.mnem_tombstone_node(callArgs, localClient ?? noLocalClient()); break;
      case "mnem_delete_node":     text = await local.mnem_delete_node(callArgs, localClient ?? noLocalClient()); break;
      case "mnem_traverse":        text = await local.mnem_traverse(callArgs, localClient ?? noLocalClient(), mnemBin, localRepoPath!); break;
      case "mnem_incoming_edges":  text = await local.mnem_incoming_edges(callArgs, localClient ?? noLocalClient(), mnemBin, localRepoPath!); break;
      case "mnem_ingest":          text = await local.mnem_ingest(callArgs, localClient ?? noLocalClient()); break;
      case "mnem_community_summarize": text = await local.mnem_community_summarize(callArgs, localClient ?? noLocalClient(), mnemBin, localRepoPath!); break;
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
