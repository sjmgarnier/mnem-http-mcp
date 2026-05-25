import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveClient } from "../src/routing.ts";
import type { MnemClient } from "../src/client.ts";

const TMP = join(tmpdir(), "mnem-route-test-" + Date.now());

beforeEach(() => mkdirSync(join(TMP, ".mnem"), { recursive: true }));
afterEach(() => rmSync(TMP, { recursive: true, force: true }));

const fakeGlobalClient = { baseUrl: "http://127.0.0.1:9999" } as unknown as MnemClient;
const fakeLocalClient  = { baseUrl: "http://127.0.0.1:8888" } as unknown as MnemClient;
const fakeGlobalPath   = "/home/user/.mnemglobal";

const getLocalClient = mock(async (_path: string) => fakeLocalClient);

describe("resolveClient", () => {
  test("throws when neither global nor repo provided", async () => {
    await expect(
      resolveClient({}, fakeGlobalPath, fakeGlobalClient, getLocalClient)
    ).rejects.toThrow('pass "global": true or "repo"');
  });

  test("returns globalClient when global: true", async () => {
    const result = await resolveClient(
      { global: true },
      fakeGlobalPath,
      fakeGlobalClient,
      getLocalClient
    );
    expect(result.client).toBe(fakeGlobalClient);
    expect(result.repoPath).toBe(fakeGlobalPath);
  });

  test("returns localClient and resolved path when repo given", async () => {
    const sub = join(TMP, "src");
    mkdirSync(sub, { recursive: true });
    const result = await resolveClient(
      { repo: sub },
      fakeGlobalPath,
      fakeGlobalClient,
      getLocalClient
    );
    expect(result.client).toBe(fakeLocalClient);
    expect(result.repoPath).toBe(TMP); // walked up from TMP/src to TMP
  });

  test("throws when repo given but no .mnem found", async () => {
    const clean = join(tmpdir(), "no-mnem-" + Date.now());
    mkdirSync(clean, { recursive: true });
    try {
      await expect(
        resolveClient({ repo: clean }, fakeGlobalPath, fakeGlobalClient, getLocalClient)
      ).rejects.toThrow("No .mnem graph found");
    } finally {
      rmSync(clean, { recursive: true, force: true });
    }
  });

  test("uses repo when both global and repo provided", async () => {
    const result = await resolveClient(
      { global: true, repo: TMP },
      fakeGlobalPath,
      fakeGlobalClient,
      getLocalClient
    );
    expect(result.client).toBe(fakeLocalClient);
    expect(result.repoPath).toBe(TMP);
  });
});
