import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const LOCAL_TOOLS: Tool[] = [
  {
    name: "mnem_stats",
    description: "Repository overview: op-head, head commit, ref summary, known labels. Cheap; call this first to discover what a repo contains.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "mnem_schema",
    description: "Inspect the schema of the current commit: node labels, edge predicates, index presence. This tool is available via MCP only; there is no HTTP equivalent.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "mnem_recent",
    description: "List recent operations from the op-log.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", default: 20 } },
      additionalProperties: false,
    },
  },
  {
    name: "mnem_list_tags",
    description: "List all tags in the current repo.",
    inputSchema: {
      type: "object",
      properties: { json: { type: "boolean" } },
      additionalProperties: false,
    },
  },
  {
    name: "mnem_list_nodes",
    description: "List nodes, optionally filtered by label.",
    inputSchema: {
      type: "object",
      properties: {
        label: { type: "string" },
        limit: { type: "integer" },
        offset: { type: "integer" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "mnem_search",
    description: "Search for nodes by label and/or property filter.",
    inputSchema: {
      type: "object",
      properties: {
        label: { type: "string" },
        limit: { type: "integer" },
        where: { type: "object" },
        with_outgoing: { type: "array", items: { type: "string" } },
      },
      additionalProperties: false,
    },
  },
  {
    name: "mnem_get_node",
    description: "Fetch a single node by UUID.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Node UUID (hyphenated form)." } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "mnem_retrieve",
    description: "Agent-facing retrieval: hybrid BM25 + vector + graph-expand. The primary tool for querying the graph.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        label: { type: "string" },
        where: { type: "object" },
        limit: { type: "integer", default: 10, minimum: 1, maximum: 500 },
        token_budget: { type: "integer" },
        fusion: { type: "string", enum: ["convex_min_max", "rrf"] },
        graph_expand: { type: "integer" },
        graph_depth: { type: "integer" },
        graph_decay: { type: "number" },
        graph_etype: { type: "array", items: { type: "string" } },
        graph_mode: { type: "string" },
        graph_max_per_seed: { type: "integer" },
        ppr_damping: { type: "number" },
        ppr_iter: { type: "integer" },
        rerank_top_k: { type: "integer" },
        vector: { type: "object" },
        vector_cap: { type: "integer" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "mnem_vector_search",
    description: "Search by raw embedding vector.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
        vector: { type: "array", items: { type: "number" } },
        k: { type: "integer" },
      },
      required: ["model", "vector"],
      additionalProperties: false,
    },
  },
  {
    name: "mnem_commit",
    description: "Commit one or more nodes (and optional edges) in a single operation.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Required. Stored as the Commit author." },
        nodes: { type: "array", items: { type: "object", properties: { ntype: { type: "string" }, summary: { type: "string" }, props: { type: "object" } } } },
        edges: { type: "array" },
        message: { type: "string" },
        task_id: { type: "string" },
      },
      required: ["agent_id"],
      additionalProperties: false,
    },
  },
  {
    name: "mnem_commit_relation",
    description: "Compound write: resolve-or-create subject node, resolve-or-create object node, connect with edge.",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string" },
        predicate: { type: "string" },
        object: { type: "string" },
        subject_kind: { type: "string" },
        object_kind: { type: "string" },
        subject_props: { type: "object" },
        object_props: { type: "object" },
        edge_props: { type: "object" },
        anchor: { type: "string", default: "name" },
        agent_id: { type: "string" },
        message: { type: "string" },
      },
      required: ["subject", "predicate", "object"],
      additionalProperties: false,
    },
  },
  {
    name: "mnem_resolve_or_create",
    description: "Find-or-create an entity node by a natural-language name.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        value: {},
        label: { type: "string" },
        kind: { type: "string" },
        prop_name: { type: "string" },
        extra_props: { type: "object" },
        global: { type: "boolean" },
        agent_id: { type: "string" },
        task_id: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "mnem_tombstone_node",
    description: "Soft-delete a node. Tombstoned nodes are excluded from retrieve but remain in the blockstore.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        agent_id: { type: "string" },
        reason: { type: "string" },
        message: { type: "string" },
      },
      required: ["id", "agent_id"],
      additionalProperties: false,
    },
  },
  {
    name: "mnem_delete_node",
    description: "Hard-delete a node. No audit trail.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        agent_id: { type: "string" },
        message: { type: "string" },
      },
      required: ["id", "agent_id"],
      additionalProperties: false,
    },
  },
  {
    name: "mnem_traverse",
    description: "From a start node, list outgoing neighbours reachable via specified edge labels.",
    inputSchema: {
      type: "object",
      properties: {
        start: { type: "string" },
        edge_labels: { type: "array", items: { type: "string" } },
        limit: { type: "integer", default: 25, minimum: 1, maximum: 200 },
      },
      required: ["start"],
      additionalProperties: false,
    },
  },
  {
    name: "mnem_incoming_edges",
    description: "List nodes that point to the given node.",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Destination node UUID." },
        etype: { type: "string" },
        limit: { type: "integer" },
        json: { type: "boolean" },
      },
      required: ["node"],
      additionalProperties: false,
    },
  },
  {
    name: "mnem_ingest",
    description: "Ingest a source as a Doc + Chunk + Entity subgraph.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        text: { type: "string" },
        source: { type: "string" },
        ntype: { type: "string" },
        agent_id: { type: "string" },
        chunker: { type: "string" },
        max_tokens: { type: "integer" },
        overlap: { type: "integer" },
        message: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "mnem_community_summarize",
    description: "Summarize a community of nodes with MMR sentence selection.",
    inputSchema: {
      type: "object",
      properties: {
        node_ids: { type: "array", items: { type: "string" } },
        query: { type: "string" },
        k: { type: "integer" },
        mmr_lambda: { type: "number" },
      },
      required: ["node_ids"],
      additionalProperties: false,
    },
  },
];

export const GLOBAL_TOOLS: Tool[] = [
  {
    name: "mnem_global_retrieve",
    description: "Search the global graph (~/.mnemglobal/.mnem/) only.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        limit: { type: "integer" },
        token_budget: { type: "integer" },
        vector: { type: "object" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "mnem_global_add",
    description: "Add a node (or nodes) directly to the global graph.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string" },
        nodes: { type: "array" },
        edges: { type: "array" },
        message: { type: "string" },
      },
      required: ["agent_id"],
      additionalProperties: false,
    },
  },
  {
    name: "mnem_global_ingest",
    description: "Ingest a source into the global graph.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        text: { type: "string" },
        source: { type: "string" },
        ntype: { type: "string" },
        agent_id: { type: "string" },
        chunker: { type: "string" },
        max_tokens: { type: "integer" },
        overlap: { type: "integer" },
        message: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "mnem_global_tombstone_node",
    description: "Soft-delete a node in the global graph.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        agent_id: { type: "string" },
        reason: { type: "string" },
        message: { type: "string" },
      },
      required: ["id", "agent_id"],
      additionalProperties: false,
    },
  },
];
