import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
  assertPublicTargetUrl,
  fetchTextWithTimeout,
  isPrivateAddress,
  ResponseTooLargeError,
  UnsafeTargetError,
} from "../src/utils/http.js";

async function withServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("proteção SSRF bloqueia endereços privados e reservados", async () => {
  for (const address of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "::1", "fc00::1"]) {
    assert.equal(isPrivateAddress(address), true);
  }
  await assert.rejects(
    assertPublicTargetUrl("http://127.0.0.1/admin"),
    UnsafeTargetError,
  );
  await assert.rejects(
    assertPublicTargetUrl("http://localhost/admin"),
    UnsafeTargetError,
  );
});

test("leitura HTTP interrompe respostas acima do limite", async () => {
  await withServer((_req, res) => res.end("x".repeat(2_000)), async (baseUrl) => {
    await assert.rejects(
      fetchTextWithTimeout(baseUrl, { timeoutMs: 1_000, maxBytes: 100 }),
      ResponseTooLargeError,
    );
  });
});

test("leitura HTTP propaga cancelamento ao socket", async () => {
  await withServer((_req, res) => {
    res.write("início");
  }, async (baseUrl) => {
    const controller = new AbortController();
    const request = fetchTextWithTimeout(baseUrl, {
      timeoutMs: 5_000,
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(new Error("cancelado pelo teste")), 20);
    await assert.rejects(request, /cancelado pelo teste/);
  });
});
