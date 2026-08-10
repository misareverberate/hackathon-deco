import type { KnowledgeBase } from "../../knowledge/knowledgeBuilder.js";
import type { GeoReadinessReport } from "./types.js";
import { QuestionGenerator } from "./questionGenerator.js";
import { GapAnalyzer } from "./gapAnalyzer.js";
import { Scoring } from "./scoring.js";
import { RecommendationBuilder } from "./recommendationBuilder.js";
import { GroqClient, type LlmGateway } from "../../llm/groq.js";
import { resolveSecret } from "../../config/env.js";
import { BuyerJourneyAgent } from "./buyerJourneyAgent.js";
import { MissionGenerator, selectBalancedQuestions } from "./missionGenerator.js";
import type { BuyerJourney } from "./types.js";

const SIMULATION_VERSION = "buyer-journey-v2";

export interface GeoAgentOptions {
  llm?: LlmGateway;
  maxQuestions?: number;
  concurrency?: number;
  journeyTimeoutMs?: number;
  totalBudgetMs?: number;
  env?: NodeJS.ProcessEnv;
}

function boundedInteger(
  value: number | string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed)
    ? Math.min(max, Math.max(min, Math.floor(parsed)))
    : fallback;
}

export class GeoAgent {
  private readonly questionGenerator = new QuestionGenerator();
  private readonly llm: LlmGateway | undefined;
  private readonly journeyAgent: BuyerJourneyAgent;
  private readonly missionGenerator = new MissionGenerator();
  private readonly gapAnalyzer = new GapAnalyzer();
  private readonly scoring = new Scoring();
  private readonly recommendationBuilder = new RecommendationBuilder();
  private readonly maxQuestions: number;
  private readonly concurrency: number;
  private readonly journeyTimeoutMs: number;
  private readonly totalBudgetMs: number;

  constructor(options: GeoAgentOptions = {}) {
    const env = options.env ?? process.env;
    const llmRequested =
      options.llm !== undefined || resolveSecret("GEO_LLM", env) === "on";
    this.llm = llmRequested
      ? (options.llm ?? new GroqClient({ env }))
      : undefined;
    this.journeyAgent = new BuyerJourneyAgent(this.llm);
    this.maxQuestions = boundedInteger(
      options.maxQuestions ?? env.GEO_MAX_QUESTIONS,
      12,
      1,
      100,
    );
    this.concurrency = boundedInteger(
      options.concurrency ?? env.GEO_CONCURRENCY,
      4,
      1,
      16,
    );
    this.journeyTimeoutMs = boundedInteger(
      options.journeyTimeoutMs ?? env.GEO_JOURNEY_TIMEOUT_MS,
      30_000,
      1_000,
      180_000,
    );
    this.totalBudgetMs = boundedInteger(
      options.totalBudgetMs ?? env.GEO_TOTAL_BUDGET_MS,
      75_000,
      1_000,
      180_000,
    );
  }

  async run(
    knowledge: KnowledgeBase,
    signal?: AbortSignal,
  ): Promise<GeoReadinessReport> {
    const startedAt = Date.now();
    const deadline = startedAt + this.totalBudgetMs;
    const metricsBefore = this.llm?.getMetrics?.();
    const questions = selectBalancedQuestions(
      this.questionGenerator.generate(knowledge),
      this.maxQuestions,
    );
    const missions = this.missionGenerator.fromQuestions(questions, knowledge);
    const outcomes = await this.mapWithConcurrency(missions, async (mission) => {
      try {
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
          throw new Error("Orçamento total das jornadas excedido (timeout)");
        }
        const journey = await this.withTimeout(
          (journeySignal) => this.journeyAgent.run(mission, knowledge, journeySignal),
          Math.min(this.journeyTimeoutMs, remainingMs),
          signal,
        );
        return { mission, journey };
      } catch (error) {
        if (signal?.aborted) throw signal.reason ?? error;
        const message = error instanceof Error ? error.message : String(error);
        return {
          mission,
          error: {
            missionId: mission.id,
            code: message.includes("timeout") ? "TIMEOUT" as const : "SIMULATION_ERROR" as const,
            message,
          },
        };
      }
    });
    const journeys = outcomes
      .map((outcome) => outcome.journey)
      .filter((journey): journey is BuyerJourney => journey !== undefined);
    const simulationErrors = outcomes
      .map((outcome) => outcome.error)
      .filter((error): error is NonNullable<typeof error> => error !== undefined);
    const metricsAfter = this.llm?.getMetrics?.();
    const metricDelta = (key: "logicalCalls" | "httpRequests" | "retries" | "failures") =>
      Math.max(0, (metricsAfter?.[key] ?? 0) - (metricsBefore?.[key] ?? 0));
    const evaluations = journeys.map((journey) => journey.evaluation);
    const missingAttributes =
      this.gapAnalyzer.analyzeMissingAttributes(evaluations);
    const categoryScores = this.scoring.buildCategoryScores(evaluations);
    const personaScores = this.scoring.buildPersonaScores(evaluations);
    const schemaCoverage =
      knowledge.products.length === 0
        ? 1
        : knowledge.products.filter((product) => product.schemaIds.length > 0)
            .length / knowledge.products.length;
    const overallScore = this.scoring.calculate(evaluations, schemaCoverage);
    const productPageMap = knowledge.products.reduce<Record<string, string>>(
      (acc, product) => {
        const pageId = product.pageIds[0];
        if (pageId) {
          acc[product.id] = pageId;
        }
        return acc;
      },
      {},
    );
    const pageUrlMap = knowledge.pages.reduce<Record<string, string>>(
      (acc, page) => {
        acc[page.id] = page.url;
        return acc;
      },
      {},
    );
    const productPageProblems = this.gapAnalyzer.analyzePageProblems(
      evaluations,
      productPageMap,
      pageUrlMap,
    ).pageProblems;
    const categoryPageProblems = journeys
      .filter(
        (journey) =>
          journey.evaluation.status !== "SUCCESS" &&
          journey.evaluation.productIds.length === 0,
      )
      .flatMap((journey) => {
        const category = knowledge.categories.find(
          (item) => item.id === journey.mission.categoryId,
        );
        const pageId = category?.pageIds[0];
        return pageId
          ? [{
              pageId,
              url: pageUrlMap[pageId] ?? category?.url ?? "",
              reason: `Jornada abandonada em ${journey.mission.categoryName}: ${journey.finalState.decisionReason ?? "sem resposta suficiente"}`,
            }]
          : [];
      });
    const pageProblems = [...productPageProblems, ...categoryPageProblems].filter(
      (problem, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.pageId === problem.pageId && candidate.reason === problem.reason,
        ) === index,
    );
    const recommendations = this.recommendationBuilder.build(
      evaluations,
      missingAttributes,
    );

    const failures = evaluations.filter(
      (evaluation) => evaluation.status !== "SUCCESS",
    );
    const successRate =
      evaluations.length === 0
        ? 0
        : evaluations.filter((evaluation) => evaluation.status === "SUCCESS")
            .length / evaluations.length;

    return {
      overallScore,
      successRate,
      llmEnabled: this.llm?.isConfigured() ?? false,
      categoryScores,
      personaScores,
      questionsTested: questions.length,
      failures,
      missingAttributes,
      pageProblems,
      recommendations,
      journeys,
      simulationErrors,
      simulationMeta: {
        version: SIMULATION_VERSION,
        durationMs: Date.now() - startedAt,
        requestedJourneys: missions.length,
        completedJourneys: journeys.length,
        failedJourneys: simulationErrors.length,
        maxQuestions: this.maxQuestions,
        concurrency: this.concurrency,
        journeyTimeoutMs: this.journeyTimeoutMs,
        totalBudgetMs: this.totalBudgetMs,
        llmLogicalCalls: metricDelta("logicalCalls"),
        llmHttpRequests: metricDelta("httpRequests"),
        llmRetries: metricDelta("retries"),
        llmFailures: metricDelta("failures"),
      },
      details: {
        evaluations,
        missingAttributes,
        pageProblems,
      },
    };
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    worker: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let cursor = 0;

    async function consume(): Promise<void> {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) {
          return;
        }
        results[index] = await worker(items[index]);
      }
    }

    const workers: Promise<void>[] = [];
    const poolSize = Math.min(this.concurrency, items.length);
    for (let i = 0; i < poolSize; i += 1) {
      workers.push(consume());
    }
    await Promise.all(workers);
    return results;
  }

  private async withTimeout<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number,
    parentSignal?: AbortSignal,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error(`Jornada excedeu timeout de ${timeoutMs}ms`)),
      timeoutMs,
    );
    const signal = parentSignal
      ? AbortSignal.any([parentSignal, controller.signal])
      : controller.signal;
    const aborted = new Promise<never>((_, reject) => {
      signal.addEventListener(
        "abort",
        () => reject(signal.reason ?? new Error("Jornada cancelada.")),
        { once: true },
      );
    });
    try {
      return await Promise.race([operation(signal), aborted]);
    } finally {
      clearTimeout(timer);
    }
  }
}
