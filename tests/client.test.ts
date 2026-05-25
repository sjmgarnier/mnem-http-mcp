import { describe, test, expect } from "bun:test";
import { MnemClient } from "../src/client.ts";

describe("MnemClient", () => {
  test("constructs base URL from port", () => {
    const c = new MnemClient(9876, "tok");
    expect(c.baseUrl).toBe("http://127.0.0.1:9876");
  });

  test("buildAuthHeaders includes Authorization when token set", () => {
    const c = new MnemClient(9876, "mytoken");
    const h = c.buildAuthHeaders();
    expect(h["Authorization"]).toBe("Bearer mytoken");
  });

  test("buildAuthHeaders returns empty object when no token", () => {
    const c = new MnemClient(9876, "");
    const h = c.buildAuthHeaders();
    expect(h["Authorization"]).toBeUndefined();
  });
});
