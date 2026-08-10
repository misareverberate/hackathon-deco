import test from "node:test";
import assert from "node:assert/strict";
import { configureLlmRateLimit, extractJson, GroqClient } from "../src/llm/groq.js";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("extractJson parses fenced, plain and embedded JSON", () => {
  assert.deepEqual(extractJson('```json\n{"a": 1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('{"a": 1}'), { a: 1 });
  assert.deepEqual(extractJson('prefixo {"b": 2}'), { b: 2 });
});

test("extractJson returns null for garbage and arrays", () => {
  assert.equal(extractJson("sem json"), null);
  assert.equal(extractJson("[1, 2]"), null);
  assert.equal(extractJson(""), null);
});

test("GroqClient isConfigured reflects api key presence", () => {
  assert.equal(new GroqClient({ apiKey: "" }).isConfigured(), false);
  assert.equal(new GroqClient({ apiKey: "test-key" }).isConfigured(), true);
});

test("GroqClient retries on 429 and returns parsed JSON", async () => {
  configureLlmRateLimit(undefined);
  let calls = 0;
  const fetchFn = async () => {
    calls += 1;
    if (calls === 1) {
      return jsonResponse({ error: "rate limited" }, 429);
    }
    return jsonResponse({
      choices: [{ message: { content: '{"ok": true}' } }],
    });
  };
  const client = new GroqClient({ apiKey: "test-key", fetchFn, maxRetries: 2 });
  const result = await client.chatJson([{ role: "user", content: "oi" }]);
  assert.deepEqual(result, { ok: true });
  assert.equal(calls, 2);
});

test("GroqClient honra Retry-After no 429 antes de tentar novamente", async () => {
  configureLlmRateLimit(undefined);
  let calls = 0;
  const fetchFn = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({ error: "rate limited" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "1",
        },
      });
    }
    return jsonResponse({
      choices: [{ message: { content: '{"ok": true}' } }],
    });
  };
  const client = new GroqClient({ apiKey: "test-key", fetchFn, maxRetries: 1 });
  const result = await client.chatJson([{ role: "user", content: "oi" }]);
  assert.deepEqual(result, { ok: true });
  assert.equal(calls, 2);
});

test("GroqClient returns null when not configured", async () => {
  const client = new GroqClient({ apiKey: "" });
  assert.equal(await client.chatJson([{ role: "user", content: "oi" }]), null);
});

test("GroqClient returns null after exhausting retries on 5xx", async () => {
  configureLlmRateLimit(undefined);
  let calls = 0;
  const fetchFn = async () => {
    calls += 1;
    return jsonResponse({ error: "boom" }, 500);
  };
  const client = new GroqClient({ apiKey: "test-key", fetchFn, maxRetries: 1 });
  const result = await client.chatJson([{ role: "user", content: "oi" }]);
  assert.equal(result, null);
  assert.equal(calls, 2);
});

test("GroqClient cancela a requisição e não inicia retries após abort", async () => {
  configureLlmRateLimit(undefined);
  let calls = 0;
  let requestAborted = false;
  const fetchFn: typeof fetch = (_input, init) => {
    calls += 1;
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        requestAborted = true;
        reject(init.signal?.reason);
      }, { once: true });
    });
  };
  const client = new GroqClient({ apiKey: "test-key", fetchFn, maxRetries: 2 });
  const controller = new AbortController();
  const result = client.chatJson([{ role: "user", content: "oi" }], controller.signal);
  controller.abort(new Error("análise cancelada"));

  await assert.rejects(result, /análise cancelada/);
  assert.equal(requestAborted, true);
  assert.equal(calls, 1);
});

test("429 abre o circuit breaker e chamadas seguintes falham rápido", async () => {
  configureLlmRateLimit(undefined);
  let calls = 0;
  const fetchFn = async () => {
    calls += 1;
    return jsonResponse({ error: "rate limited" }, 429);
  };
  const client = new GroqClient({ apiKey: "test-key", fetchFn, maxRetries: 0 });
  const first = await client.chatJson([{ role: "user", content: "oi" }]);
  assert.equal(first, null);
  assert.equal(calls, 1);

  const second = await new GroqClient({ apiKey: "test-key", fetchFn }).chatJson([
    { role: "user", content: "oi" },
  ]);
  assert.equal(second, null);
  assert.equal(calls, 1);
  configureLlmRateLimit(undefined);
});

test("pacing limita as requisições por minuto", async () => {
  configureLlmRateLimit(2);
  let calls = 0;
  const fetchFn = async () => {
    calls += 1;
    return jsonResponse({
      choices: [{ message: { content: '{"ok": true}' } }],
    });
  };
  const client = new GroqClient({ apiKey: "test-key", fetchFn });
  assert.deepEqual(await client.chatJson([{ role: "user", content: "oi" }]), { ok: true });
  assert.deepEqual(await client.chatJson([{ role: "user", content: "oi" }]), { ok: true });
  assert.equal(await client.chatJson([{ role: "user", content: "oi" }]), null);
  assert.equal(calls, 2);
  configureLlmRateLimit(undefined);
});
