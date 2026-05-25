export interface NodeRecord {
  id: string;
  label: string;
  summary: string;
  props: Record<string, unknown>;
  content_bytes: number;
  has_embedding: boolean;
}

export interface PostNodeBody {
  label?: string;
  summary: string;
  props?: Record<string, unknown>;
  author: string;
  message?: string;
}

export interface PostEdgeBody {
  src: string;
  dst: string;
  label: string;
  props?: Record<string, unknown>;
  author: string;
  message?: string;
}

export interface RetrieveBody {
  text?: string;
  label?: string;
  where?: Record<string, unknown>;
  limit?: number;
  token_budget?: number;
  fusion?: string;
  graph_expand?: number;
  graph_depth?: number;
  graph_decay?: number;
  graph_etype?: string[];
  graph_mode?: string;
  graph_max_per_seed?: number;
  ppr_damping?: number;
  ppr_iter?: number;
  rerank_top_k?: number;
  vector?: Record<string, unknown>;
  vector_cap?: number;
  with_outgoing?: string[];
}

async function mnemFetch(url: string, options: RequestInit): Promise<unknown> {
  const res = await fetch(url, options);
  const body = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = body;
  }
  if (typeof parsed === "object" && parsed !== null && "error" in parsed) {
    throw new Error((parsed as { error: string }).error);
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return parsed;
}

export class MnemClient {
  readonly baseUrl: string;
  private readonly token: string;

  constructor(port: number, token: string) {
    this.baseUrl = `http://127.0.0.1:${port}`;
    this.token = token;
  }

  buildAuthHeaders(): Record<string, string> {
    if (!this.token) return {};
    return { Authorization: `Bearer ${this.token}` };
  }

  private get jsonHeaders() {
    return { "Content-Type": "application/json", ...this.buildAuthHeaders() };
  }

  async healthz(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/healthz`);
      return res.ok;
    } catch { return false; }
  }

  async stats(): Promise<unknown> {
    return mnemFetch(`${this.baseUrl}/v1/stats`, { headers: this.buildAuthHeaders() });
  }

  async log(limit = 20): Promise<unknown> {
    return mnemFetch(`${this.baseUrl}/v1/log?limit=${limit}&format=json`, { headers: this.buildAuthHeaders() });
  }

  async tags(): Promise<unknown> {
    return mnemFetch(`${this.baseUrl}/v1/tags`, { headers: this.buildAuthHeaders() });
  }

  async getNode(id: string): Promise<unknown> {
    return mnemFetch(`${this.baseUrl}/v1/nodes/${id}`, { headers: this.buildAuthHeaders() });
  }

  async postNode(body: PostNodeBody): Promise<{ id: string; op_id: string }> {
    return mnemFetch(`${this.baseUrl}/v1/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as Promise<{ id: string; op_id: string }>;
  }

  async postNodesBulk(nodes: PostNodeBody[]): Promise<unknown> {
    return mnemFetch(`${this.baseUrl}/v1/nodes/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodes }),
    });
  }

  async deleteNode(id: string, author: string): Promise<unknown> {
    return mnemFetch(`${this.baseUrl}/v1/nodes/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...this.buildAuthHeaders() },
      body: JSON.stringify({ author }),
    });
  }

  async tombstoneNode(id: string, author: string, reason?: string): Promise<unknown> {
    return mnemFetch(`${this.baseUrl}/v1/nodes/${id}/tombstone`, {
      method: "POST",
      headers: this.jsonHeaders,
      body: JSON.stringify({ author, reason }),
    });
  }

  async postEdge(body: PostEdgeBody): Promise<unknown> {
    return mnemFetch(`${this.baseUrl}/v1/edges`, {
      method: "POST",
      headers: this.jsonHeaders,
      body: JSON.stringify(body),
    });
  }

  async retrieve(body: RetrieveBody): Promise<unknown> {
    return mnemFetch(`${this.baseUrl}/v1/retrieve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async ingest(body: {
    path?: string;
    text?: string;
    source?: string;
    ntype?: string;
    agent_id?: string;
    chunker?: string;
    max_tokens?: number;
    overlap?: number;
    message?: string;
  }): Promise<unknown> {
    const { agent_id, ntype, ...rest } = body;
    return mnemFetch(`${this.baseUrl}/v1/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rest, author: agent_id, label: ntype }),
    });
  }
}
