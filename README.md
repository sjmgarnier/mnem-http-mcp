# mnem-http-mcp

A drop-in replacement for `mnem mcp` that routes all operations through `mnem`'s HTTP interface. The standard `mnem mcp` holds an exclusive database lock for its entire session, which blocks CLI scripts, Python tools, and other agents from accessing the graph while a host (Claude Code, OpenCode) is open. This MCP never holds the lock itself — `mnem http` holds it only per-request.

## Prerequisites

- [`mnem`](https://github.com/Uranid/mnem) installed and on `PATH`
- A global mnem graph at `~/.mnemglobal` (run `mnem global init` if not set up)

## Installation

### With the install script (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/sjmgarnier/mnem-http-mcp/main/install.sh | bash
```

This downloads the correct binary for your platform to `~/.local/bin/mnem-http-mcp`. Make sure `~/.local/bin` is in your `PATH`.

### Manual download

Download the binary for your platform from the [latest GitHub release](https://github.com/sjmgarnier/mnem-http-mcp/releases/latest):

| Platform | Binary |
|---|---|
| macOS (Apple Silicon) | `mnem-http-mcp-darwin-arm64` |
| macOS (Intel) | `mnem-http-mcp-darwin-x64` |
| Linux x86-64 | `mnem-http-mcp-linux-x64` |
| Linux arm64 | `mnem-http-mcp-linux-arm64` |
| Windows x86-64 | `mnem-http-mcp-windows-x64.exe` |

Place it somewhere on your `PATH` and make it executable (`chmod +x` on macOS/Linux).

## Host integration

Add one entry to your MCP host's config, then restart the host.

**Claude Code** (`~/.claude/settings.json`):
```json
{
  "mcpServers": {
    "mnem": { "command": "/path/to/mnem-http-mcp" }
  }
}
```

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "mnem": { "command": "/path/to/mnem-http-mcp" }
  }
}
```

**OpenCode** (`~/.config/opencode/opencode.json`):
```json
{
  "mcp": {
    "mnem": { "command": "/path/to/mnem-http-mcp", "type": "local" }
  }
}
```

The `integrate` subcommand does this automatically:

```bash
mnem-http-mcp integrate              # prompts for each detected host
mnem-http-mcp integrate --claude           # Claude Code only
mnem-http-mcp integrate --claude-desktop   # Claude Desktop only
mnem-http-mcp integrate --opencode         # OpenCode only
```

## How it works

On startup the MCP starts (or connects to) a `mnem http` server for the global graph at `~/.mnemglobal`, registers 18 MCP tools, and begins the JSON-RPC loop. No local graph is opened at startup.

Each tool call must specify its target graph:

| Parameter | Behaviour |
|---|---|
| `"global": true` | Route to the global graph (`~/.mnemglobal`) |
| `"repo": "/path/to/project"` | Walk up from that path to find `.mnem/`, start or connect to a `mnem http` server for it, and route the call there |

Omitting both raises an error. If both are provided, `repo` takes precedence (with a warning).

Local servers are started on first use and cached for the MCP's process lifetime. If a `mnem http` server is already running for a given graph (detected via `http-server.json` + `/v1/healthz`), the MCP connects to it and leaves it alone on shutdown. If the MCP spawned the server itself, it shuts it down when it exits.

Port and auth token are stored in `.mnem/http-server.json` inside each graph root, so external processes (Python scripts, other agents) can discover and connect to the same server:

```python
import json, requests

cfg = json.load(open(".mnem/http-server.json"))
port, token = cfg["port"], cfg["token"]

# Read
requests.get(f"http://127.0.0.1:{port}/v1/stats")

# Write nodes (no auth needed)
requests.post(f"http://127.0.0.1:{port}/v1/nodes", json={
    "summary": "...", "label": "Fact", "author": "my-script"
})

# Write edges (auth required)
requests.post(f"http://127.0.0.1:{port}/v1/edges",
    json={"src": "...", "dst": "...", "label": "relates_to", "author": "my-script"},
    headers={"Authorization": f"Bearer {token}"}
)
```

## CLI flags

```
mnem-http-mcp [--mnem-bin <path>] [--debug]
mnem-http-mcp integrate [--claude] [--claude-desktop] [--opencode]
```

**Server flags:**

| Flag | Default | Description |
|---|---|---|
| `--mnem-bin <path>` | `mnem` | Path to the mnem binary |
| `--debug` | off | Log tool calls and real-time server stderr to stderr |

**`integrate` flags:**

| Flag | Config file patched |
|---|---|
| `--claude` | `~/.claude/settings.json` |
| `--claude-desktop` | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| `--opencode` | `~/.config/opencode/opencode.json` |

## Tools

Every tool accepts `"global": true` or `"repo": "/path"` to select the target graph. One is required per call.

| Tool | Description |
|---|---|
| `mnem_retrieve` | Hybrid BM25 + vector + graph-expand retrieval |
| `mnem_commit` | Commit nodes and edges |
| `mnem_commit_relation` | Resolve-or-create two nodes and connect with an edge |
| `mnem_resolve_or_create` | Find-or-create an entity node by name |
| `mnem_tombstone_node` | Soft-delete a node |
| `mnem_delete_node` | Hard-delete a node |
| `mnem_get_node` | Fetch a single node by UUID |
| `mnem_stats` | Graph overview |
| `mnem_recent` | Recent op-log entries |
| `mnem_list_tags` | All tags |
| `mnem_list_nodes` | Nodes filtered by label |
| `mnem_search` | Filter nodes by label and/or properties |
| `mnem_vector_search` | Search by raw embedding vector |
| `mnem_ingest` | Ingest a document as Doc + Chunk subgraph |
| `mnem_traverse` | Outgoing neighbours via edge labels |
| `mnem_incoming_edges` | Nodes pointing to a given node |
| `mnem_schema` | Node labels, edge predicates, index presence |
| `mnem_community_summarize` | Summarize a community of nodes (not yet available in this version of mnem) |

## Development

```bash
bun install
bun run dev          # Run from source
bun test             # Run tests
bun run build:current  # Build binary for current platform → dist/mnem-http-mcp
```

Requires [Bun](https://bun.sh) 1.x.
