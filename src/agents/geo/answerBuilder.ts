import type {
  KnowledgeBase,
  BuyerResponse,
  RawEvaluation,
  SimulatedAnswer,
  SimulatedAnswerFact,
} from "./types.js";
import { parseBrlPrice } from "./price.js";

export class AnswerBuilder {
  build(
    response: BuyerResponse,
    evaluation: RawEvaluation,
    knowledge: KnowledgeBase,
  ): SimulatedAnswer {
    const facts = this.resolveFacts(response, knowledge);
    const blockingAttributes = evaluation.missingAttributes;
    const text = this.buildText(response, facts, blockingAttributes);

    return { text, facts, blockingAttributes };
  }

  private resolveFacts(
    response: BuyerResponse,
    knowledge: KnowledgeBase,
  ): SimulatedAnswerFact[] {
    const byId = new Map(knowledge.products.map((product) => [product.id, product]));
    return response.productIds
      .map((productId) => byId.get(productId))
      .filter((product) => product !== undefined)
      .map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price ? this.formatPrice(product.price) : undefined,
        brand: product.brand,
      }));
  }

  private buildText(
    response: BuyerResponse,
    facts: SimulatedAnswerFact[],
    blockingAttributes: string[],
  ): string {
    const category = response.categoryName.toLowerCase();
    if (facts.length === 0) {
      if (blockingAttributes.length > 0) {
        return `Não encontrei um ${category} que responda à pergunta: os dados estruturados não declaram ${blockingAttributes.join(", ")}.`;
      }
      return `Não encontrei um ${category} compatível no catálogo para esta pergunta.`;
    }

    if (blockingAttributes.length === 0) {
      const names = facts.map((fact) =>
        fact.price ? `${fact.name} (${fact.price})` : fact.name,
      );
      return `Recomendo ${this.joinNames(names)} — atende à pergunta com dados estruturados completos.`;
    }

    return `Identifiquei candidatos, mas não posso confirmar a recomendação: faltam dados estruturados de ${blockingAttributes.join(", ")}.`;
  }

  private joinNames(names: string[]): string {
    if (names.length === 1) {
      return names[0];
    }
    return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
  }

  private formatPrice(raw: string): string {
    const price = parseBrlPrice(raw);
    if (price === null) {
      return raw;
    }
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(price);
  }
}
