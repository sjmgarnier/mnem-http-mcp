import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readServerDescriptor,
  writeServerDescriptor,
  removeServerDescriptor,
  descriptorPath,
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
