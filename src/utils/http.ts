import { lookup } from "node:dns/promises";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { Agent, fetch } from "undici";

const MAX_REDIRECTS = 5;
const DEFAULT_MAX_BYTES = 5_000_000;

const blockedAddresses = new BlockList();
[
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
].forEach(([network, prefix]) =>
  blockedAddresses.addSubnet(network as string, prefix as number, "ipv4"),
);
[
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
].forEach(([network, prefix]) =>
  blockedAddresses.addSubnet(network as string, prefix as number, "ipv6"),
);

export class UnsafeTargetError extends Error {}
export class ResponseTooLargeError extends Error {}

export interface FetchTextOptions {
  timeoutMs: number;
  signal?: AbortSignal;
  maxBytes?: number;
  blockPrivateNetworks?: boolean;
  headers?: Record<string, string>;
}

export interface TextResponse {
  ok: boolean;
  status: number;
  url: string;
  headers: Headers;
  text: string;
}

export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4
    ? blockedAddresses.check(address, "ipv4")
    : family === 6
      ? blockedAddresses.check(address, "ipv6")
      : true;
}

export async function assertPublicTargetUrl(rawUrl: string): Promise<void> {
  const target = new URL(rawUrl);
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new UnsafeTargetError("Apenas destinos HTTP e HTTPS são permitidos.");
  }
  if (target.username || target.password) {
    throw new UnsafeTargetError("URLs com credenciais embutidas não são permitidas.");
  }
  const literalFamily = isIP(target.hostname);
  if (literalFamily > 0) {
    if (isPrivateAddress(target.hostname)) {
      throw new UnsafeTargetError("O destino aponta para uma rede privada ou reservada.");
    }
    return;
  }
  if (target.hostname.toLowerCase() === "localhost") {
    throw new UnsafeTargetError("Hosts locais não são permitidos.");
  }
  const addresses = await lookup(target.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new UnsafeTargetError("O destino resolve para uma rede privada ou reservada.");
  }
}

const safeLookup: LookupFunction = (hostname, options, callback) => {
  void lookup(hostname, {
    all: true,
    verbatim: true,
    family: options.family,
    hints: options.hints,
  }).then((addresses) => {
    if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
      callback(new UnsafeTargetError("DNS resolveu para uma rede privada ou reservada."), "", 0);
      return;
    }
    const selected = addresses[0];
    callback(null, selected.address, selected.family);
  }, (error: NodeJS.ErrnoException) => callback(error, "", 0));
};

const publicAgent = new Agent();
const safeAgent = new Agent({ connect: { lookup: safeLookup } });

export async function fetchTextWithTimeout(
  rawUrl: string,
  options: FetchTextOptions,
): Promise<TextResponse> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`Timeout de ${options.timeoutMs}ms`)),
    options.timeoutMs,
  );
  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  let currentUrl = new URL(rawUrl).toString();

  try {
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      if (options.blockPrivateNetworks) {
        await assertPublicTargetUrl(currentUrl);
      }
      const response = await fetch(currentUrl, {
        redirect: "manual",
        signal,
        headers: options.headers,
        dispatcher: options.blockPrivateNetworks ? safeAgent : publicAgent,
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) {
          throw new Error(`Redirect ${response.status} sem cabeçalho Location.`);
        }
        if (redirect === MAX_REDIRECTS) {
          throw new Error(`Limite de ${MAX_REDIRECTS} redirects excedido.`);
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      const declaredSize = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
        await response.body?.cancel();
        throw new ResponseTooLargeError(`Resposta excede o limite de ${maxBytes} bytes.`);
      }

      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      if (response.body) {
        const reader = response.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          totalBytes += value.byteLength;
          if (totalBytes > maxBytes) {
            await reader.cancel();
            throw new ResponseTooLargeError(`Resposta excede o limite de ${maxBytes} bytes.`);
          }
          chunks.push(value);
        }
      }
      const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), totalBytes);
      return {
        ok: response.ok,
        status: response.status,
        url: currentUrl,
        headers: response.headers,
        text: body.toString("utf-8"),
      };
    }
    throw new Error("Fluxo de redirect inválido.");
  } finally {
    clearTimeout(timer);
  }
}
