import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface EnvFile {
  [key: string]: string;
}

export function parseEnvFile(content: string): EnvFile {
  const env: EnvFile = {};
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      return;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      return;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key !== "") {
      env[key] = value;
    }
  });
  return env;
}

export function loadEnvFile(path: string = ".env"): EnvFile {
  try {
    return parseEnvFile(readFileSync(resolve(path), "utf-8"));
  } catch {
    return {};
  }
}

export function resolveSecret(
  key: string,
  env: NodeJS.ProcessEnv = process.env,
  path: string = ".env",
): string {
  const direct = env[key];
  if (direct !== undefined && direct !== "") {
    return direct;
  }
  return loadEnvFile(path)[key] ?? "";
}
