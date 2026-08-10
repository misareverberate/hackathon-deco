import type {
  BuyerActionType,
  BuyerJourney,
  BuyerJourneyStep,
  BuyerMission,
  BuyerObservation,
  BuyerResponse,
  BuyerState,
  GeoQuestion,
  KnowledgeBase,
} from "./types.js";
import { BuyerSimulator } from "./buyerSimulator.js";
import { ResponseEvaluator } from "./responseEvaluator.js";
import { AnswerBuilder } from "./answerBuilder.js";
import type { LlmGateway } from "../../llm/groq.js";
import { parseBrlPrice } from "./price.js";
import { isAvailableForPurchase } from "./availability.js";

const POLICY_ATTRIBUTES = ["garantia", "troca", "entrega", "devolucao"];

export class BuyerJourneyAgent {
  private readonly simulator: BuyerSimulator;
  private readonly evaluator: ResponseEvaluator;
  private readonly answerBuilder = new AnswerBuilder();

  constructor(llm?: LlmGateway) {
    this.simulator = new BuyerSimulator(llm);
    // Facts may come from the LLM, but the final verdict stays deterministic
    // so one model cannot overrule grounded catalog evidence.
    this.evaluator = new ResponseEvaluator();
  }

  async run(
    mission: BuyerMission,
    knowledge: KnowledgeBase,
    signal?: AbortSignal,
  ): Promise<BuyerJourney> {
    const state: BuyerState = {
      missionId: mission.id,
      consideredProductIds: [],
      inspectedProductIds: [],
      rejectedProductIds: [],
      openQuestions: [],
      satisfiedConstraints: [],
      missingAttributes: [],
      conversionBlockers: [],
      confidence: 40,
      decision: "UNRESOLVED",
    };
    const steps: BuyerJourneyStep[] = [];
    let buyerResponse: BuyerResponse | null = null;

    while (state.decision === "UNRESOLVED" && steps.length < mission.maxSteps) {
      signal?.throwIfAborted();
      const action = this.planNextAction(mission, state, steps);
      const before = state.confidence;
      const observation = await this.execute(
        action,
        mission,
        state,
        knowledge,
        buyerResponse,
        signal,
      );
      if (action === "search_catalog") {
        buyerResponse = observation.response;
      }
      this.updateState(action, observation.observation, state, mission);
      steps.push({
        index: steps.length + 1,
        action,
        reason: observation.reason,
        observation: observation.observation,
        confidenceBefore: before,
        confidenceAfter: state.confidence,
      });
    }

    if (state.decision === "UNRESOLVED") {
      state.decision = "ABANDON";
      state.decisionReason = "A jornada atingiu o limite de passos sem evidência suficiente para comprar.";
    }

    const response = buyerResponse ?? this.emptyResponse(mission);
    const rawEvaluation = await this.evaluator.evaluate({
      ...response,
      productIds: state.consideredProductIds,
      missingAttributes: state.missingAttributes,
      confidence: state.confidence,
      explanation: state.decisionReason ?? response.explanation,
    }, signal);
    const groundedEvaluation = {
      ...rawEvaluation,
      status: state.decision === "PURCHASE"
        ? rawEvaluation.status
        : state.consideredProductIds.length > 0 ? "PARTIAL" as const : "FAIL" as const,
      answer: this.answerBuilder.build(response, rawEvaluation, knowledge),
    };

    return { id: `journey:${mission.id}`, mission, steps, finalState: state, evaluation: groundedEvaluation };
  }

  private planNextAction(
    mission: BuyerMission,
    state: BuyerState,
    steps: BuyerJourneyStep[],
  ): BuyerActionType {
    const used = new Set(steps.map((step) => step.action));
    if (!used.has("search_catalog")) return "search_catalog";
    if (state.consideredProductIds.length === 0) {
      return used.has("ask_follow_up") ? "abandon_journey" : "ask_follow_up";
    }
    if (state.inspectedProductIds.length === 0) return "inspect_product";
    if (
      (mission.persona === "compare" || mission.persona === "price") &&
      state.consideredProductIds.length > 1 &&
      !used.has("compare_products")
    ) return "compare_products";
    if (
      state.openQuestions.some((question) => this.isPolicyAttribute(question)) &&
      !used.has("inspect_store_policy")
    ) return "inspect_store_policy";
    if (state.openQuestions.length > 0 && !used.has("ask_follow_up")) return "ask_follow_up";
    if (steps.length >= mission.patience && !this.canPurchase(mission, state)) {
      return "abandon_journey";
    }
    return this.canPurchase(mission, state) ? "finish_purchase" : "abandon_journey";
  }

  private async execute(
    action: BuyerActionType,
    mission: BuyerMission,
    state: BuyerState,
    knowledge: KnowledgeBase,
    previousResponse: BuyerResponse | null,
    signal?: AbortSignal,
  ): Promise<{ reason: string; observation: BuyerObservation; response: BuyerResponse | null }> {
    if (action === "search_catalog") {
      const question: GeoQuestion = {
        id: mission.id,
        categoryId: mission.categoryId,
        categoryName: mission.categoryName,
        persona: mission.persona,
        text: mission.goal,
        constraints: mission.constraints,
        candidateProductIds: mission.candidateProductIds,
      };
      const response = await this.simulator.simulate(question, knowledge, signal);
      return {
        reason: "Descobrir candidatos que atendam às restrições da missão.",
        response,
        observation: {
          action,
          summary: response.explanation,
          evidence: response.productIds.map((id) => this.productEvidence(id, knowledge)),
          productIds: response.productIds,
          missingAttributes: response.missingAttributes,
        },
      };
    }

    if (action === "inspect_product") {
      const ranked = this.rankCandidates(
        state.consideredProductIds,
        mission,
        knowledge,
      );
      const productId = ranked[0];
      const product = knowledge.products.find((item) => item.id === productId);
      const available = product ? this.availableAttributeNames(product.id, knowledge, product) : [];
      const missing = mission.expectedAttributes.filter((name) =>
        !available.some((candidate) => this.sameName(candidate, name)),
      );
      return {
        reason: "Verificar se o melhor candidato possui informação suficiente para uma decisão.",
        response: previousResponse,
        observation: {
          action,
          summary: product
            ? `${product.name} possui ${available.length} sinais estruturados úteis; ${missing.length} expectativa(s) continuam abertas.`
            : "O candidato não pôde ser resolvido no catálogo.",
          evidence: available.map((name) => `${name} disponível`),
          productIds: product ? [product.id] : [],
          missingAttributes: missing,
          selectedProductId: product?.id,
        },
      };
    }

    if (action === "compare_products") {
      const ids = this.rankCandidates(
        state.consideredProductIds,
        mission,
        knowledge,
      ).slice(0, 3);
      return {
        reason: "Comparar os candidatos antes de assumir uma preferência final.",
        response: previousResponse,
        observation: {
          action,
          summary: `${ids.length} candidatos foram comparados; ${this.productName(ids[0], knowledge)} lidera a decisão.`,
          evidence: ids.map(
            (id, index) => `${index + 1}º ${this.productEvidence(id, knowledge)}`,
          ),
          productIds: ids,
          missingAttributes: state.missingAttributes,
          selectedProductId: ids[0],
        },
      };
    }

    if (action === "inspect_store_policy") {
      const questions = state.openQuestions.filter((question) =>
        this.isPolicyAttribute(question),
      );
      const policyText = [
        ...knowledge.faqs.flatMap((faq) => [faq.question, faq.answer]),
        ...knowledge.pages.flatMap((page) => [page.title, page.description]),
      ].filter((value): value is string => Boolean(value));
      const resolved = questions.filter((question) => {
        const token = this.normalize(question);
        return policyText.some((text) => this.normalize(text).includes(token));
      });
      const unresolved = state.openQuestions.filter(
        (question) => !resolved.includes(question),
      );
      return {
        reason: "Investigar garantia, entrega e troca antes da decisão final.",
        response: previousResponse,
        observation: {
          action,
          summary: resolved.length > 0
            ? `A loja respondeu ${resolved.join(", ")} em conteúdo institucional ou FAQ.`
            : `Nenhuma política respondeu às dúvidas sobre ${questions.join(", ")}.`,
          evidence: resolved.map((attribute) => `Política encontrada para ${attribute}`),
          productIds: state.consideredProductIds,
          missingAttributes: unresolved,
          resolvedAttributes: resolved,
          selectedProductId: state.selectedProductId,
        },
      };
    }

    if (action === "ask_follow_up") {
      const questions = state.openQuestions.length > 0
        ? state.openQuestions
        : mission.expectedAttributes.slice(0, 2);
      return {
        reason: "Tentar esclarecer as lacunas antes de abandonar a compra.",
        response: previousResponse,
        observation: {
          action,
          summary: `A loja não respondeu ao refinamento sobre ${questions.join(", ")}.`,
          evidence: questions.map((question) => `Sem evidência estruturada para ${question}`),
          productIds: state.consideredProductIds,
          missingAttributes: questions,
        },
      };
    }

    const purchase = action === "finish_purchase";
    return {
      reason: purchase
        ? "As restrições críticas foram satisfeitas com confiança suficiente."
        : "As lacunas remanescentes ultrapassam a tolerância desta persona.",
      response: previousResponse,
      observation: {
        action,
        summary: purchase
          ? `Comprador escolheu ${this.productName(state.selectedProductId, knowledge)} e decidiu avançar.`
          : "Comprador abandonou a jornada.",
        evidence: state.selectedProductId
          ? [this.productEvidence(state.selectedProductId, knowledge)]
          : state.consideredProductIds.map((id) => this.productEvidence(id, knowledge)),
        productIds: state.consideredProductIds,
        missingAttributes: state.missingAttributes,
        selectedProductId: state.selectedProductId,
      },
    };
  }

  private updateState(
    action: BuyerActionType,
    observation: BuyerObservation,
    state: BuyerState,
    mission: BuyerMission,
  ): void {
    state.consideredProductIds = [...new Set([...state.consideredProductIds, ...observation.productIds])];
    state.missingAttributes = [...new Set(observation.missingAttributes)];
    state.openQuestions = [...state.missingAttributes];
    state.conversionBlockers = [...state.missingAttributes];
    if (observation.selectedProductId) {
      state.selectedProductId = observation.selectedProductId;
    }
    if (action === "search_catalog") {
      state.satisfiedConstraints = mission.constraints
        .map((constraint) => constraint.attributeName)
        .filter((name) => !state.missingAttributes.includes(name));
      state.confidence = observation.productIds.length > 0
        ? Math.max(55, 100 - state.missingAttributes.length * 15)
        : 20;
    } else if (action === "inspect_product") {
      state.inspectedProductIds = [...new Set([...state.inspectedProductIds, ...observation.productIds])];
      state.confidence = Math.min(
        100,
        Math.max(15, state.confidence - observation.missingAttributes.length * 5 + 10),
      );
    } else if (action === "compare_products") {
      state.rejectedProductIds = [...new Set([
        ...state.rejectedProductIds,
        ...observation.productIds.slice(1),
      ])];
      state.confidence = Math.min(100, state.confidence + 8);
    } else if (action === "inspect_store_policy") {
      state.confidence = observation.resolvedAttributes?.length
        ? Math.min(100, state.confidence + observation.resolvedAttributes.length * 8)
        : Math.max(10, state.confidence - 8);
    } else if (action === "ask_follow_up") {
      state.confidence = Math.max(10, state.confidence - 15);
    } else if (action === "finish_purchase") {
      state.decision = "PURCHASE";
      state.decisionReason = `Escolheu ${state.selectedProductId ?? "o melhor candidato"} com confiança ${state.confidence}/100.`;
    } else if (action === "abandon_journey") {
      state.decision = "ABANDON";
      state.decisionReason = state.consideredProductIds.length === 0
        ? "Nenhum produto atendeu às restrições da missão."
        : `Atributos sem resposta: ${state.missingAttributes.join(", ") || "evidência insuficiente"}.`;
    }
  }

  private canPurchase(mission: BuyerMission, state: BuyerState): boolean {
    const tolerance = Math.floor(mission.riskTolerance * 4);
    const confidenceThreshold = Math.round(85 - mission.riskTolerance * 30);
    const comparisonSatisfied = mission.persona !== "compare" || state.consideredProductIds.length >= 2;
    return comparisonSatisfied && state.missingAttributes.length <= tolerance && state.confidence >= confidenceThreshold;
  }

  private rankCandidates(
    productIds: string[],
    mission: BuyerMission,
    knowledge: KnowledgeBase,
  ): string[] {
    return [...productIds].sort((leftId, rightId) =>
      this.productUtility(rightId, mission, knowledge) -
      this.productUtility(leftId, mission, knowledge),
    );
  }

  private productUtility(
    productId: string,
    mission: BuyerMission,
    knowledge: KnowledgeBase,
  ): number {
    const product = knowledge.products.find((item) => item.id === productId);
    if (!product) return -1;
    const attributeCount = knowledge.attributes.filter((attribute) =>
      attribute.productIds.includes(productId),
    ).length;
    const price = parseBrlPrice(product.price);
    const budgetFit = mission.budget && price !== null
      ? Math.max(0, 40 - (price / mission.budget) * 30)
      : price !== null ? Math.max(0, 20 - price / 10_000) : 0;
    const availability = isAvailableForPurchase(product.availability) ? 12 : -30;
    const brand = product.brand ? 15 : 0;
    const schema = product.schemaIds.length > 0 ? 8 : 0;
    switch (mission.persona) {
      case "price": return budgetFit * 2 + availability + attributeCount;
      case "spec": return attributeCount * 12 + schema + availability;
      case "brand": return brand * 2 + schema + availability + attributeCount * 2;
      case "compare": return attributeCount * 8 + budgetFit + availability + schema;
    }
  }

  private availableAttributeNames(
    productId: string,
    knowledge: KnowledgeBase,
    product: KnowledgeBase["products"][number],
  ): string[] {
    return [
      ...(product.price ? ["Preço"] : []),
      ...(product.brand ? ["Marca"] : []),
      ...(isAvailableForPurchase(product.availability) ? ["Disponibilidade"] : []),
      ...knowledge.attributes.filter((attribute) => attribute.productIds.includes(productId)).map((attribute) => attribute.name),
    ];
  }

  private sameName(left: string, right: string): boolean {
    const a = this.normalize(left);
    const b = this.normalize(right);
    if (b === "especificacoes") return !["preco", "marca", "disponibilidade"].includes(a);
    return a === b || a.includes(b) || b.includes(a);
  }

  private normalize(value: string): string {
    return value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  private isPolicyAttribute(value: string): boolean {
    const normalized = this.normalize(value);
    return POLICY_ATTRIBUTES.some((attribute) => normalized.includes(attribute));
  }

  private productName(productId: string | undefined, knowledge: KnowledgeBase): string {
    if (!productId) return "o melhor candidato";
    return knowledge.products.find((item) => item.id === productId)?.name ?? productId;
  }

  private productEvidence(productId: string, knowledge: KnowledgeBase): string {
    const product = knowledge.products.find((item) => item.id === productId);
    return product
      ? `${product.name}${product.price ? ` · ${product.price}` : ""}${product.brand ? ` · ${product.brand}` : ""}`
      : productId;
  }

  private emptyResponse(mission: BuyerMission): BuyerResponse {
    return {
      questionId: mission.id,
      questionText: mission.goal,
      categoryId: mission.categoryId,
      categoryName: mission.categoryName,
      persona: mission.persona,
      productIds: [],
      matchedAttributes: [],
      missingAttributes: mission.constraints.map((constraint) => constraint.attributeName),
      explanation: "A jornada terminou sem resposta do catálogo.",
      confidence: 0,
    };
  }
}
