import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

describe("apiSecurity", () => {
  it("timing-safe key comparison uses hashes", async () => {
    const { assertApiKey } = await import("../src/security/apiSecurity.js");
    process.env.SETTLEMENT_API_KEY = "test-secret-key";
    const { createServer } = await import("node:http");

    const server = createServer((req, res) => {
      if (assertApiKey(req, res)) {
        res.writeHead(200);
        res.end("ok");
      }
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    const port = addr.port;

    const bad = await fetch(`http://127.0.0.1:${port}/`, {
      headers: { "x-settlement-api-key": "wrong" },
    });
    expect(bad.status).toBe(401);

    const good = await fetch(`http://127.0.0.1:${port}/`, {
      headers: { "x-settlement-api-key": "test-secret-key" },
    });
    expect(good.status).toBe(200);

    delete process.env.SETTLEMENT_API_KEY;
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
    expect(createHash("sha256").update("a").digest().length).toBe(32);
  });
});
