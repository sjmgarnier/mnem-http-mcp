import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readServerDescriptor,
  writeServerDescriptor,
  removeServerDescriptor,
  descriptorPath,
  walkUp,
  isLockError,
} from "../src/server.ts";

const TMP = join(tmpdir(), "mnem-test-" + Date.now());
const MNEM_DIR = join(TMP, ".mnem");

beforeEach(() => mkdirSync(MNEM_DIR, { recursive: true }));
afterEach(() => rmSync(TMP, { recursive: true, force: true }));

describe("descriptorPath", () => {
  test("returns path inside .mnem", () => {
    expect(descriptorPath(TMP)).toBe(join(MNEM_DIR, "http-server.json"));
  });
});

describe("writeServerDescriptor / readServerDescriptor", () => {
  test("round-trips port and token", () => {
    writeServerDescriptor(TMP, { port: 9876, token: "abc123" });
    const result = readServerDescriptor(TMP);
    expect(result).toEqual({ port: 9876, token: "abc123" });
  });

  test("readServerDescriptor returns null when file absent", () => {
    expect(readServerDescriptor(TMP)).toBeNull();
  });
});

describe("removeServerDescriptor", () => {
  test("deletes the file", () => {
    writeServerDescriptor(TMP, { port: 9876, token: "x" });
    removeServerDescriptor(TMP);
    expect(existsSync(descriptorPath(TMP))).toBe(false);
  });

  test("does not throw when file absent", () => {
    expect(() => removeServerDescriptor(TMP)).not.toThrow();
  });
});

describe("walkUp", () => {
  test("returns graphRoot when .mnem exists at given path", () => {
    // MNEM_DIR (join(TMP, ".mnem")) is created in beforeEach
    expect(walkUp(TMP)).toBe(TMP);
  });

  test("walks up from subdirectory to find .mnem", () => {
    const sub = join(TMP, "src", "deep");
    mkdirSync(sub, { recursive: true });
    expect(walkUp(sub)).toBe(TMP);
  });

  test("returns null when no .mnem found", () => {
    const clean = join(tmpdir(), "mnem-clean-" + Date.now());
    mkdirSync(clean, { recursive: true });
    try {
      expect(walkUp(clean)).toBeNull();
    } finally {
      rmSync(clean, { recursive: true, force: true });
    }
  });
});

describe("isLockError", () => {
  test("returns true for redb lock error message", () => {
    expect(isLockError("error: store: io: redb: Database already open. Cannot acquire lock.")).toBe(true);
  });

  test("returns true when lock message appears mid-output", () => {
    const full = `[INFO] starting\nerror: store: io: redb: Database already open. Cannot acquire lock.\n`;
    expect(isLockError(full)).toBe(true);
  });

  test("returns false for unrelated error", () => {
    expect(isLockError("error: address already in use")).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isLockError("")).toBe(false);
  });
});
