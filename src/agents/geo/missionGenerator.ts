import type {
  BuyerMission,
  BuyerPersona,
  GeoQuestion,
  KnowledgeBase,
} from "./types.js";
import {
  PERSONA_EXPECTATIONS,
  expectedAttributesForCategory,
} from "./expectations.js";

const PERSONA_BEHAVIOR: Record<
  BuyerPersona,
  { context: string; priorities: string[]; riskTolerance: number; patience: number }
> = {
  price: {
    context: "Precisa justificar cada real gasto e aceita trocar preferências secundárias por economia.",
    priorities: ["Preço", "Disponibilidade", "Custo-benefício"],
    riskTolerance: 0.55,
    patience: 4,
  },
  spec: {
    context: "Depende de requisitos técnicos para o produto funcionar no uso pretendido.",
    priorities: ["Especificações", "Compatibilidade", "Garantia"],
    riskTolerance: 0.15,
    patience: 6,
  },
  brand: {
    context: "Usa reputação, garantia e procedência para reduzir o risco percebido.",
    priorities: ["Marca", "Garantia", "Troca"],
    riskTolerance: 0.3,
    patience: 4,
  },
  compare: {
    context: "Só decide depois de confrontar alternativas com os mesmos critérios.",
    priorities: ["Especificações", "Preço", "Disponibilidade"],
    riskTolerance: 0.35,
    patience: 6,
  },
};

export class MissionGenerator {
  fromQuestions(questions: GeoQuestion[], knowledge: KnowledgeBase): BuyerMission[] {
    return questions.map((question) => {
      const behavior = PERSONA_BEHAVIOR[question.persona];
      const categoryExpected = expectedAttributesForCategory(question.categoryName);
      const categoryProductIds = new Set(
        knowledge.products
          .filter((product) => product.categoryId === question.categoryId)
          .map((product) => product.id),
      );
      const observedNames = knowledge.attributes
        .filter((attribute) =>
          attribute.productIds.some((productId) => categoryProductIds.has(productId)),
        )
        .slice(0, 3)
        .map((attribute) => attribute.name);
      return {
        id: `mission:${question.id}`,
        persona: question.persona,
        categoryId: question.categoryId,
        categoryName: question.categoryName,
        goal: question.text,
        context: behavior.context,
        constraints: question.constraints,
        candidateProductIds: question.candidateProductIds,
        expectedAttributes: [...new Set([
          ...PERSONA_EXPECTATIONS[question.persona],
          ...categoryExpected,
          ...observedNames,
        ])].slice(0, 6),
        budget: this.budget(question),
        priorities: behavior.priorities,
        riskTolerance: behavior.riskTolerance,
        patience: behavior.patience,
        maxSteps: behavior.patience + 2,
      };
    });
  }

  private budget(question: GeoQuestion): number | undefined {
    const price = question.constraints.find((constraint) => constraint.attributeName === "Preço");
    if (!price) return undefined;
    const value = Number(price.normalizedValue);
    return Number.isFinite(value) ? value : undefined;
  }
}

export function selectBalancedQuestions(
  questions: GeoQuestion[],
  limit: number,
): GeoQuestion[] {
  const personaOrder: BuyerPersona[] = ["price", "spec", "brand", "compare"];
  const buckets = new Map<BuyerPersona, GeoQuestion[]>(
    personaOrder.map((persona) => [persona, []]),
  );
  for (const question of questions) {
    buckets.get(question.persona)?.push(question);
  }
  const selected: GeoQuestion[] = [];
  while (selected.length < limit) {
    let consumed = false;
    for (const persona of personaOrder) {
      const bucket = buckets.get(persona);
      if (bucket) {
        const usedCategories = new Set(
          selected
            .filter((question) => question.persona === persona)
            .map((question) => question.categoryId),
        );
        const freshCategoryIndex = bucket.findIndex(
          (question) => !usedCategories.has(question.categoryId),
        );
        if (freshCategoryIndex > 0) {
          const [fresh] = bucket.splice(freshCategoryIndex, 1);
          bucket.unshift(fresh);
        }
      }
      const next = bucket?.shift();
      if (!next) continue;
      selected.push(next);
      consumed = true;
      if (selected.length === limit) break;
    }
    if (!consumed) break;
  }
  return selected;
}
