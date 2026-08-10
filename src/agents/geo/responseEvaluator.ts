import type {
  BuyerResponse,
  EvaluationStatus,
  RawEvaluation,
} from "./types.js";
import { buildEvaluationMessages } from "./prompts.js";
import type { LlmGateway } from "../../llm/groq.js";

export class ResponseEvaluator {
  constructor(private readonly llm?: LlmGateway) {}

  async evaluate(response: BuyerResponse, signal?: AbortSignal): Promise<RawEvaluation> {
    if (this.llm?.isConfigured()) {
      try {
        const llmResult = await this.evaluateWithLlm(response, signal);
        if (llmResult) {
          return llmResult;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        console.warn(`[geo] LLM avaliador falhou, usando fallback: ${message}`);
      }
    }
    return this.evaluateRuleBased(response);
  }

  private async evaluateWithLlm(
    response: BuyerResponse,
    signal?: AbortSignal,
  ): Promise<RawEvaluation | null> {
    const messages = buildEvaluationMessages(response.persona, response);
    const parsed = await this.llm?.chatJson(messages, signal);
    if (!parsed) {
      return null;
    }
    const proposedStatus = this.parseStatus(parsed.status);
    const confidence = this.clampConfidence(parsed.confidence);
    const llmMissingAttributes = Array.isArray(parsed.missingAttributes)
      ? (parsed.missingAttributes as unknown[]).filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    const missingAttributes = [...new Set([
      ...response.missingAttributes,
      ...llmMissingAttributes,
    ])];
    const status = this.groundStatus(
      proposedStatus,
      response.productIds.length,
      missingAttributes.length,
    );

    return {
      questionId: response.questionId,
      questionText: response.questionText,
      categoryId: response.categoryId,
      categoryName: response.categoryName,
      persona: response.persona,
      status,
      productIds: response.productIds,
      missingAttributes,
      explanation:
        typeof parsed.explanation === "string"
          ? parsed.explanation
          : "Avaliação do comprador via LLM.",
      confidence,
    };
  }

  private parseStatus(value: unknown): EvaluationStatus {
    if (value === "SUCCESS" || value === "PARTIAL" || value === "FAIL") {
      return value;
    }
    return "PARTIAL";
  }

  private clampConfidence(value: unknown): number {
    if (typeof value !== "number") {
      return 50;
    }
    return Math.min(Math.max(Math.round(value), 0), 100);
  }

  private groundStatus(
    proposed: EvaluationStatus,
    productCount: number,
    missingCount: number,
  ): EvaluationStatus {
    if (productCount === 0) return "FAIL";
    if (missingCount > 0) return "PARTIAL";
    return proposed === "FAIL" ? "PARTIAL" : proposed;
  }

  evaluateRuleBased(response: BuyerResponse): RawEvaluation {
    const { confidence } = response;
    const status = this.groundStatus(
      confidence >= 80 ? "SUCCESS" : confidence >= 40 ? "PARTIAL" : "FAIL",
      response.productIds.length,
      response.missingAttributes.length,
    );

    return {
      questionId: response.questionId,
      questionText: response.questionText,
      categoryId: response.categoryId,
      categoryName: response.categoryName,
      persona: response.persona,
      status,
      productIds: response.productIds,
      missingAttributes: response.missingAttributes,
      explanation: response.explanation,
      confidence,
    };
  }
}
