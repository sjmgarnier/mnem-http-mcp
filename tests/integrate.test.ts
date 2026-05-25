import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { patchClaudeSettings, patchOpenCodeSettings } from "../src/integrate.ts";

const TMP = join(tmpdir(), "integrate-test-" + Date.now());

beforeEach(() => mkdirSync(TMP, { recursive: true }));
afterEach(() => rmSync(TMP, { recursive: true, force: true }));

describe("patchClaudeSettings", () => {
  test("adds mnem entry to existing mcpServers", () => {
    const configPath = join(TMP, "settings.json");
    writeFileSync(configPath, JSON.stringify({ mcpServers: {} }));
    patchClaudeSettings(configPath, "/usr/local/bin/mnem-http-mcp");
    const result = JSON.parse(readFileSync(configPath, "utf8"));
    expect(result.mcpServers.mnem.command).toBe("/usr/local/bin/mnem-http-mcp");
  });

  test("creates mcpServers if absent", () => {
    const configPath = join(TMP, "settings.json");
    writeFileSync(configPath, JSON.stringify({}));
    patchClaudeSettings(configPath, "/usr/local/bin/mnem-http-mcp");
    const result = JSON.parse(readFileSync(configPath, "utf8"));
    expect(result.mcpServers.mnem).toBeDefined();
  });
});

describe("patchOpenCodeSettings", () => {
  test("adds mnem entry to mcp section", () => {
    const configPath = join(TMP, "opencode.json");
    writeFileSync(configPath, JSON.stringify({ mcp: {} }));
    patchOpenCodeSettings(configPath, "/usr/local/bin/mnem-http-mcp");
    const result = JSON.parse(readFileSync(configPath, "utf8"));
    expect(result.mcp.mnem.command).toBe("/usr/local/bin/mnem-http-mcp");
    expect(result.mcp.mnem.type).toBe("local");
  });

  test("creates mcp section if absent", () => {
    const configPath = join(TMP, "opencode.json");
    writeFileSync(configPath, JSON.stringify({}));
    patchOpenCodeSettings(configPath, "/usr/local/bin/mnem-http-mcp");
    const result = JSON.parse(readFileSync(configPath, "utf8"));
    expect(result.mcp.mnem).toBeDefined();
  });
});
