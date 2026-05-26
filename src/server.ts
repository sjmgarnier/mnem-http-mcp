import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";

export function walkUp(from: string): string | null {
  let current = from;
  while (true) {
    if (existsSync(join(current, ".mnem"))) return current;
    const parent = join(current, "..");
    if (parent === current) return null;
    current = parent;
  }
}

export function isLockError(stderr: string): boolean {
  return stderr.includes("Database already open. Cannot acquire lock.");
}

export interface ServerDescriptor {
  port: number;
  token: string;
}

export interface ServerHandle {
  port: number;
  token: string;
  owned: boolean;
  process?: ReturnType<typeof Bun.spawn>;
}

export function descriptorPath(graphRoot: string): string {
  return join(graphRoot, ".mnem", "http-server.json");
}

export function readServerDescriptor(graphRoot: string): ServerDescriptor | null {
  const p = descriptorPath(graphRoot);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as ServerDescriptor;
  } catch (e) {
    console.error(`[mnem-http-mcp] warning: failed to parse descriptor at ${descriptorPath(graphRoot)}: ${e}`);
    return null;
  }
}

export function writeServerDescriptor(graphRoot: string, desc: ServerDescriptor): void {
  writeFileSync(descriptorPath(graphRoot), JSON.stringify(desc), "utf8");
}

export function removeServerDescriptor(graphRoot: string): void {
  try {
    unlinkSync(descriptorPath(graphRoot));
  } catch {
    // file may not exist — ignore
  }
}

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (!addr || typeof addr === "string") {
        srv.close();
        return reject(new Error("unexpected addr"));
      }
      const port = addr.port;
      srv.close(() => resolve(port));
    });
  });
}

async function isReachable(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/v1/healthz`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function ensureServer(
  graphRoot: string,
  mnemBin: string,
  debug: boolean
): Promise<ServerHandle> {
  const existing = readServerDescriptor(graphRoot);

  if (existing && await isReachable(existing.port)) {
    if (debug) console.error(`[mnem-http-mcp] connected to pre-existing server at port ${existing.port} for ${graphRoot}`);
    return { port: existing.port, token: existing.token, owned: false };
  }

  // Stale or absent — spawn a new server
  const port = await findFreePort();
  const token = generateToken();

  const proc = Bun.spawn(
    [mnemBin, "http", "--repo", graphRoot, "--bind", `127.0.0.1:${port}`],
    {
      env: { ...process.env, MNEM_HTTP_PUSH_TOKEN: token, MNEM_LABELS: "1" },
      stdout: "ignore",
      stderr: "pipe",
    }
  );

  if (!proc.stderr) throw new Error(`Failed to open stderr pipe for mnem http at ${graphRoot}`);

  // Stream stderr: accumulate for error detection; forward each chunk in real-time in debug mode
  let stderrText = "";
  const drainStderr = (async () => {
    for await (const chunk of proc.stderr as ReadableStream<Uint8Array>) {
      const text = new TextDecoder().decode(chunk);
      stderrText += text;
      if (debug) process.stderr.write(chunk);
    }
  })();

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await isReachable(port)) break;
    if (proc.exitCode !== null) {
      await drainStderr;
      if (isLockError(stderrText)) {
        throw new Error(
          `mnem database at ${graphRoot} is already held by another process. ` +
          `Stop the other server, or add an http-server.json descriptor at ` +
          `${join(graphRoot, ".mnem", "http-server.json")} to connect to it.`
        );
      }
      throw new Error(`mnem http server exited with code ${proc.exitCode} for ${graphRoot}: ${stderrText.trim()}`);
    }
    await Bun.sleep(100);
  }
  if (!await isReachable(port)) {
    proc.kill();
    throw new Error(`mnem http server failed to start within 10s for ${graphRoot}`);
  }

  writeServerDescriptor(graphRoot, { port, token });
  if (debug) console.error(`[mnem-http-mcp] spawned server at port ${port} for ${graphRoot}`);

  return { port, token, owned: true, process: proc };
}

export function shutdownServer(handle: ServerHandle, graphRoot: string): void {
  if (!handle.owned) return;
  handle.process?.kill("SIGKILL");
  removeServerDescriptor(graphRoot);
}
