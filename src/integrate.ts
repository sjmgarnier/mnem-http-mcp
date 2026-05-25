import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import * as readline from "node:readline";

function readJson(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return {}; }
}

function writeJson(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function patchClaudeSettings(configPath: string, binaryPath: string): void {
  const config = readJson(configPath);
  if (!config.mcpServers) config.mcpServers = {};
  (config.mcpServers as Record<string, unknown>).mnem = { command: binaryPath };
  writeJson(configPath, config);
}

export function patchOpenCodeSettings(configPath: string, binaryPath: string): void {
  const config = readJson(configPath);
  if (!config.mcp) config.mcp = {};
  (config.mcp as Record<string, unknown>).mnem = { command: binaryPath, type: "local" };
  writeJson(configPath, config);
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

export async function runIntegrate(binaryPath: string, flags: { claude?: boolean; opencode?: boolean }): Promise<void> {
  const claudeConfig = join(homedir(), ".claude", "settings.json");
  const opencodeConfig = join(homedir(), ".config", "opencode", "opencode.json");

  const doAll = !flags.claude && !flags.opencode;

  if (flags.claude || (doAll && existsSync(claudeConfig))) {
    let doClaude = true;
    if (doAll) {
      const ans = await prompt("Configure Claude Code? (y/n) ");
      doClaude = ans.toLowerCase() === "y";
    }
    if (doClaude) {
      patchClaudeSettings(claudeConfig, binaryPath);
      console.log(`✓ Claude Code: updated ${claudeConfig}`);
    }
  }

  if (flags.opencode || (doAll && existsSync(opencodeConfig))) {
    let doOpenCode = true;
    if (doAll) {
      const ans = await prompt("Configure OpenCode? (y/n) ");
      doOpenCode = ans.toLowerCase() === "y";
    }
    if (doOpenCode) {
      patchOpenCodeSettings(opencodeConfig, binaryPath);
      console.log(`✓ OpenCode: updated ${opencodeConfig}`);
    }
  }
}
