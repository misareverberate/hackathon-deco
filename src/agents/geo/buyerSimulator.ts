import type {
  KnowledgeBase,
  BuyerResponse,
  GeoQuestion,
  QuestionConstraint,
} from "./types.js";
import { buildKnowledgeContext, buildBuyerMessages } from "./prompts.js";
import { parseBrlPrice } from "./price.js";
import { UNCATEGORIZED_CATEGORY_ID } from "./questionGenerator.js";
import { Normalizer } from "../../knowledge/normalizer.js";
import type { LlmGateway } from "../../llm/groq.js";
import { isAvailableForPurchase } from "./availability.js";

export class BuyerSimulator {
  constructor(
    private readonly llm?: LlmGateway,
    private readonly normalizer = new Normalizer(),
  ) {}

  async simulate(
    question: GeoQuestion,
    knowledge: KnowledgeBase,
    signal?: AbortSignal,
  ): Promise<BuyerResponse> {
    if (this.llm?.isConfigured()) {
      try {
        const llmResponse = await this.simulateWithLlm(question, knowledge, signal);
        if (llmResponse) {
          return llmResponse;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        console.warn(`[geo] LLM buyer falhou, usando fallback: ${message}`);
      }
    }
    return this.simulateRuleBased(question, knowledge);
  }

  private async simulateWithLlm(
    question: GeoQuestion,
    knowledge: KnowledgeBase,
    signal?: AbortSignal,
  ): Promise<BuyerResponse | null> {
    const messages = buildBuyerMessages(
      question.persona,
      question,
      buildKnowledgeContext(knowledge, question.categoryId, question),
    );
    const parsed = await this.llm?.chatJson(messages, signal);
    if (!parsed) {
      return null;
    }
    return this.buildLlmResponse(question, knowledge, parsed);
  }

  private categoryProductIds(
    knowledge: KnowledgeBase,
    categoryId: string,
    allowedProductIds?: string[],
  ): string[] {
    const allowed = allowedProductIds ? new Set(allowedProductIds) : null;
    const ids = new Set<string>();
    for (const product of knowledge.products) {
      const matches =
        categoryId === UNCATEGORIZED_CATEGORY_ID
          ? !product.categoryId
          : product.categoryId === categoryId;
      if (matches) {
        if (!allowed || allowed.has(product.id)) ids.add(product.id);
      }
    }
    return [...ids];
  }

  private buildLlmResponse(
    question: GeoQuestion,
    knowledge: KnowledgeBase,
    parsed: Record<string, unknown>,
  ): BuyerResponse {
    const candidateIds = new Set(this.categoryProductIds(knowledge, question.categoryId, question.candidateProductIds));
    const rawProductIds = Array.isArray(parsed.productIds)
      ? (parsed.productIds as unknown[]).filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    const deterministicIds = knowledge.products
      .filter((product) => candidateIds.has(product.id))
      .filter((product) => question.constraints.every((constraint) =>
        this.constraintMatchesProduct(constraint, product, knowledge),
      ))
      .map((product) => product.id);
    const deterministicSet = new Set(deterministicIds);
    const productIds = [
      ...rawProductIds.filter((id) => deterministicSet.has(id)),
      ...deterministicIds,
    ].filter((id, index, all) => all.indexOf(id) === index);

    const groundedIds = new Set(productIds);
    const constraintMatched = question.constraints
      .filter((constraint) =>
        knowledge.products.some(
          (product) => groundedIds.has(product.id) &&
            this.constraintMatchesProduct(constraint, product, knowledge),
        ),
      )
      .map((constraint) => constraint.attributeName);
    const matchedAttributes = [
      ...new Set(constraintMatched.filter(
        (name) => name !== "Preço" && name !== "Marca",
      )),
    ];
    const missingAttributes = [
      ...new Set(question.constraints
        .filter(
          (constraint) => !constraintMatched.includes(constraint.attributeName),
        )
        .map((constraint) => constraint.attributeName)),
    ];

    const coverage = question.constraints.length === 0
      ? 1
      : constraintMatched.length / question.constraints.length;
    const confidence = Math.round(
      (coverage * 0.75 + (productIds.length > 0 ? 0.25 : 0)) * 100,
    );

    return {
      questionId: question.id,
      questionText: question.text,
      categoryId: question.categoryId,
      categoryName: question.categoryName,
      persona: question.persona,
      productIds,
      matchedAttributes,
      missingAttributes,
      explanation: this.buildExplanation(
        question.categoryName,
        productIds,
        missingAttributes,
      ),
      confidence,
    };
  }

  private buildExplanation(
    categoryName: string,
    productIds: string[],
    missingAttributes: string[],
  ): string {
    if (productIds.length === 0) {
      return `Não consigo determinar qual ${categoryName.toLowerCase()} atende à pergunta porque não há produtos com ${
        missingAttributes.join(", ") || "os dados necessários"
      }.`;
    }
    return "O produto foi identificado corretamente usando dados estruturados.";
  }

  simulateRuleBased(
    question: GeoQuestion,
    knowledge: KnowledgeBase,
  ): BuyerResponse {
    const allowed = question.candidateProductIds
      ? new Set(question.candidateProductIds)
      : null;
    const candidates = knowledge.products.filter((product) => {
      const categoryMatches = question.categoryId === UNCATEGORIZED_CATEGORY_ID
        ? !product.categoryId
        : product.categoryId === question.categoryId;
      return categoryMatches && (!allowed || allowed.has(product.id));
    });
    const candidateIds = new Set(candidates.map((product) => product.id));
    const matchedConstraintNames = question.constraints
      .filter((constraint) =>
        this.constraintMatchesProducts(constraint, candidateIds, knowledge),
      )
      .map((constraint) => constraint.attributeName);

    const matchedProducts = candidates.filter((product) =>
      question.constraints.every((constraint) =>
        this.constraintMatchesProduct(constraint, product, knowledge),
      ),
    );
    const productIds = matchedProducts.map((product) => product.id);

    const matchedAttributes = [
      ...new Set(
        matchedConstraintNames.filter(
          (name) => name !== "Preço" && name !== "Marca",
        ),
      ),
    ];

    const missingAttributes = [
      ...new Set(
        question.constraints
          .filter(
            (constraint) =>
              !matchedConstraintNames.includes(constraint.attributeName),
          )
          .map((constraint) => constraint.attributeName),
      ),
    ];

    const totalConstraints = question.constraints.length;
    const constraintCoverage =
      totalConstraints === 0
        ? 1
        : matchedConstraintNames.length / totalConstraints;
    const confidence = Math.round(
      (constraintCoverage * 0.75 + (productIds.length > 0 ? 0.25 : 0)) * 100,
    );

    const explanation = this.buildExplanation(
      question.categoryName,
      productIds,
      missingAttributes,
    );

    return {
      questionId: question.id,
      questionText: question.text,
      categoryId: question.categoryId,
      categoryName: question.categoryName,
      persona: question.persona,
      productIds,
      matchedAttributes,
      missingAttributes,
      explanation,
      confidence,
    };
  }

  private constraintMatchesProducts(
    constraint: QuestionConstraint,
    candidateIds: Set<string>,
    knowledge: KnowledgeBase,
  ): boolean {
    return knowledge.products.some(
      (product) =>
        candidateIds.has(product.id) &&
        this.constraintMatchesProduct(constraint, product, knowledge),
    );
  }

  private constraintMatchesProduct(
    constraint: QuestionConstraint,
    product: {
      id: string;
      price?: string;
      brand?: string;
    },
    knowledge: KnowledgeBase,
  ): boolean {
    if (constraint.normalizedValue === "") {
      return this.presenceConstraintMatches(constraint, product, knowledge);
    }

    if (constraint.attributeName === "Preço") {
      const price = parseBrlPrice(product.price);
      if (price === null) {
        return false;
      }
      const threshold = Number(constraint.normalizedValue);
      if (!Number.isFinite(threshold)) {
        return false;
      }
      return constraint.operator === "gte"
        ? price >= threshold
        : price <= threshold;
    }

    if (constraint.attributeName === "Marca") {
      if (!product.brand) {
        return false;
      }
      const normalized = this.normalizer.normalizeText(product.brand);
      const target = constraint.normalizedValue.toLowerCase().trim();
      return constraint.operator === "equals"
        ? normalized === target
        : normalized.includes(target) || target.includes(normalized);
    }

    if (constraint.attributeName === "Disponibilidade") {
      return isAvailableForPurchase(
        knowledge.products.find((item) => item.id === product.id)?.availability,
      );
    }

    if (
      constraint.normalizedName === "especificacoes" &&
      constraint.normalizedValue === ""
    ) {
      return knowledge.attributes.some((attribute) =>
        attribute.productIds.includes(product.id),
      );
    }

    return knowledge.attributes.some(
      (attribute) =>
        attribute.productIds.includes(product.id) &&
        attribute.normalizedName === constraint.normalizedName &&
        (constraint.operator === "equals"
          ? attribute.normalizedValue === constraint.normalizedValue
          : attribute.normalizedValue.includes(constraint.normalizedValue)),
    );
  }

  private presenceConstraintMatches(
    constraint: QuestionConstraint,
    product: {
      id: string;
      price?: string;
      brand?: string;
    },
    knowledge: KnowledgeBase,
  ): boolean {
    if (constraint.attributeName === "Preço") {
      return parseBrlPrice(product.price) !== null;
    }

    if (constraint.attributeName === "Marca") {
      return Boolean(product.brand);
    }

    if (constraint.attributeName === "Disponibilidade") {
      return isAvailableForPurchase(
        knowledge.products.find((item) => item.id === product.id)?.availability,
      );
    }

    if (constraint.normalizedName === "especificacoes") {
      return knowledge.attributes.some((attribute) =>
        attribute.productIds.includes(product.id),
      );
    }

    return knowledge.attributes.some(
      (attribute) =>
        attribute.productIds.includes(product.id) &&
        this.attributeNameMatches(attribute.normalizedName, constraint.normalizedName),
    );
  }

  private attributeNameMatches(left: string, right: string): boolean {
    return left === right || left.includes(right) || right.includes(left);
  }
}
