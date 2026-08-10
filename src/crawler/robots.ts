import { RobotsInfo } from "../models.js";
import { fetchTextWithTimeout } from "../utils/http.js";

const CRAWLER_TOKEN = "CommerceReadinessAgent";

interface RobotsGroup {
  agents: string[];
  allow: string[];
  disallow: string[];
}

export class RobotsParser {
  async fetchRobots(
    baseUrl: string,
    timeoutMs = 15000,
    signal?: AbortSignal,
    blockPrivateNetworks = false,
  ): Promise<RobotsInfo> {
    const robotsUrl = new URL("/robots.txt", baseUrl).toString();

    try {
      const response = await fetchTextWithTimeout(robotsUrl, {
        timeoutMs,
        signal,
        blockPrivateNetworks,
        maxBytes: 1_000_000,
        headers: { "User-Agent": `${CRAWLER_TOKEN}/1.0` },
      });
      if (!response.ok) {
        return { allow: [], disallow: [], sitemapUrls: [] };
      }

      return this.parse(response.text);
    } catch (error) {
      if (signal?.aborted) throw error;
      return { allow: [], disallow: [], sitemapUrls: [] };
    }
  }

  parse(text: string, crawlerToken = CRAWLER_TOKEN): RobotsInfo {
    const groups: RobotsGroup[] = [];
    const sitemapUrls: string[] = [];
    let current: RobotsGroup | null = null;
    let groupHasRules = false;

    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.replace(/#.*$/, "").trim();
      if (!line) continue;
      const separator = line.indexOf(":");
      if (separator < 0) continue;
      const directive = line.slice(0, separator).trim().toLowerCase();
      const value = line.slice(separator + 1).trim();

      if (directive === "sitemap") {
        if (value) sitemapUrls.push(value);
        continue;
      }
      if (directive === "user-agent") {
        if (!current || groupHasRules) {
          current = { agents: [], allow: [], disallow: [] };
          groups.push(current);
          groupHasRules = false;
        }
        if (value) current.agents.push(value.toLowerCase());
        continue;
      }
      if (!current || (directive !== "allow" && directive !== "disallow")) {
        continue;
      }
      groupHasRules = true;
      if (!value && directive === "disallow") continue;
      current[directive].push(value);
    }

    const token = crawlerToken.toLowerCase();
    const specific = groups.filter((group) =>
      group.agents.some((agent) => agent !== "*" && token.includes(agent)),
    );
    const selected = specific.length > 0
      ? specific
      : groups.filter((group) => group.agents.includes("*"));

    return {
      allow: [...new Set(selected.flatMap((group) => group.allow))],
      disallow: [...new Set(selected.flatMap((group) => group.disallow))],
      sitemapUrls: [...new Set(sitemapUrls)],
    };
  }

  isPathAllowed(path: string, robots: RobotsInfo): boolean {
    const matches = [
      ...robots.disallow.map((rule) => ({ rule, allow: false })),
      ...robots.allow.map((rule) => ({ rule, allow: true })),
    ]
      .filter(({ rule }) => rule && this.matchesRule(path, rule))
      .sort((left, right) =>
        this.ruleLength(right.rule) - this.ruleLength(left.rule) ||
        Number(right.allow) - Number(left.allow),
      );
    return matches[0]?.allow ?? true;
  }

  private ruleLength(rule: string): number {
    return rule.replace(/[*$]/g, "").length;
  }

  private matchesRule(path: string, rule: string): boolean {
    const anchored = rule.endsWith("$");
    const source = anchored ? rule.slice(0, -1) : rule;
    const escaped = source
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    const pattern = anchored ? `${escaped}$` : escaped;
    try {
      return new RegExp(`^${pattern}`).test(path);
    } catch {
      return path.startsWith(rule);
    }
  }
}
