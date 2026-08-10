import type {
  KnowledgeBase,
  GeoQuestion,
  BuyerPersona,
  QuestionConstraint,
} from "./types.js";
import { BUYER_PERSONAS } from "./personas.js";
import { parseBrlPrice } from "./price.js";
import { Normalizer } from "../../knowledge/normalizer.js";
import { expectedAttributesForCategory } from "./expectations.js";

export const UNCATEGORIZED_CATEGORY_ID = "uncategorized";

const UNCATEGORIZED_CATEGORY_NAME = "Produtos";
const MAX_UNCATEGORIZED_SPEC_QUESTIONS = 3;
const MIN_PRODUCTS_FOR_BRAND_FALLBACK = 2;
const MIN_PRODUCTS_FOR_COMPARE_FALLBACK = 2;
const MAX_SPEC_PROBES = 4;

export class QuestionGenerator {
  private readonly normalizer = new Normalizer();

  private readonly BRAND_STOPWORDS = new Set([
    "gamer",
    "gaming",
    "rgb",
    "led",
    "usb",
    "hdmi",
    "bluetooth",
    "wifi",
    "mini",
    "micro",
    "max",
    "pro",
    "plus",
    "lite",
    "premium",
    "full",
    "ultra",
    "kit",
    "combo",
    "pacote",
    "promocao",
    "promocional",
    "oferta",
    "ofertas",
    "lancamento",
    "novo",
    "nova",
    "novos",
    "novas",
    "original",
    "completo",
    "completa",
    "unico",
    "unica",
    "primeira",
    "segunda",
    "edicao",
    "especial",
    "com",
    "sem",
    "para",
    "de",
    "da",
    "do",
    "dos",
    "das",
    "em",
    "no",
    "na",
    "e",
    "ou",
    "a",
    "o",
    "os",
    "as",
    "um",
    "uma",
    "x",
    "modelo",
    "tipo",
    "linha",
    "serie",
    "versao",
    "cadeira",
    "mesa",
    "gabinete",
    "teclado",
    "mouse",
    "monitor",
    "headset",
    "fone",
    "caixa",
    "suporte",
    "webcam",
    "microfone",
    "ventoinha",
    "cooler",
    "fonte",
    "notebook",
    "computador",
    "desktop",
    "processador",
    "placa",
    "memoria",
    "ssd",
    "hdd",
    "cabo",
    "tamanho",
    "grande",
    "pequeno",
    "media",
    "medio",
  ]);

  generate(knowledge: KnowledgeBase): GeoQuestion[] {
    const questions: GeoQuestion[] = [];
    for (const category of knowledge.categories) {
      questions.push(...this.generateForCategory(knowledge, category));
    }
    const uncategorizedProducts = knowledge.products.filter(
      (product) => !product.categoryId,
    );
    if (uncategorizedProducts.length > 0) {
      questions.push(...this.generateForUncategorized(uncategorizedProducts));
    }
    return questions;
  }

  generateForCategory(
    knowledge: KnowledgeBase,
    category: { id: string; name: string },
  ): GeoQuestion[] {
    return BUYER_PERSONAS.flatMap((persona) =>
      this.generateForPersona(knowledge, category.id, persona.id),
    );
  }

  generateForUncategorized(products: KnowledgeBase["products"]): GeoQuestion[] {
    const category = {
      id: UNCATEGORIZED_CATEGORY_ID,
      name: UNCATEGORIZED_CATEGORY_NAME,
    };
    const questions: GeoQuestion[] = [];
    products
      .slice(0, MAX_UNCATEGORIZED_SPEC_QUESTIONS)
      .forEach((product, index) =>
        questions.push(...this.specFallback(category, [product], index + 1)),
      );
    if (products.length >= MIN_PRODUCTS_FOR_BRAND_FALLBACK) {
      questions.push(...this.brandFallback(category, products));
    }
    if (products.length >= MIN_PRODUCTS_FOR_COMPARE_FALLBACK) {
      questions.push(...this.compareFallback(category, products, 1));
    }
    return questions;
  }

  generateForPersona(
    knowledge: KnowledgeBase,
    categoryId: string,
    persona: BuyerPersona,
  ): GeoQuestion[] {
    switch (persona) {
      case "price":
        return this.generatePriceQuestions(knowledge, categoryId);
      case "spec":
        return this.generateSpecQuestions(knowledge, categoryId);
      case "brand":
        return this.generateBrandQuestions(knowledge, categoryId);
      case "compare":
        return this.generateCompareQuestions(knowledge, categoryId);
    }
  }

  private getCategory(
    knowledge: KnowledgeBase,
    categoryId: string,
  ): { id: string; name: string; productIds: string[] } | undefined {
    return knowledge.categories.find((category) => category.id === categoryId);
  }

  private specFallback(
    category: { id: string; name: string },
    products: KnowledgeBase["products"],
    sequence: number,
  ): GeoQuestion[] {
    const product = products[0];
    if (!product) {
      return [];
    }
    return [
      {
        id: `${category.id}:spec:fallback:${sequence}`,
        categoryId: category.id,
        categoryName: category.name,
        persona: "spec",
        text: `Quais são as especificações de ${this.cleanProductName(product.name)}?`,
        constraints: [
          this.presenceConstraint("Especificações"),
        ],
      },
    ];
  }

  private brandFallback(
    category: { id: string; name: string },
    products: KnowledgeBase["products"],
  ): GeoQuestion[] {
    const brand = this.frequentBrandToken(products);
    if (!brand) {
      return [];
    }
    return [
      {
        id: `${category.id}:brand:fallback`,
        categoryId: category.id,
        categoryName: category.name,
        persona: "brand",
        text: `Qual ${category.name.toLowerCase()} da marca ${brand} você recomenda?`,
        constraints: [
          {
            attributeName: "Marca",
            attributeValue: brand,
            normalizedName: "marca",
            normalizedValue: brand,
            operator: "equals",
          },
        ],
      },
    ];
  }

  private compareFallback(
    category: { id: string; name: string },
    products: KnowledgeBase["products"],
    sequence: number,
  ): GeoQuestion[] {
    const productA = products[0];
    const productB = products[1];
    if (!productA || !productB) {
      return [];
    }
    return [
      {
        id: `${category.id}:compare:fallback:${sequence}`,
        categoryId: category.id,
        categoryName: category.name,
        persona: "compare",
        text: `Entre ${this.cleanProductName(productA.name)} e ${this.cleanProductName(productB.name)}, qual informa especificações em dados estruturados?`,
        constraints: [
          this.presenceConstraint("Especificações"),
        ],
        candidateProductIds: [productA.id, productB.id],
      },
    ];
  }

  private presenceConstraint(attribute: string): QuestionConstraint {
    return {
      attributeName: attribute,
      attributeValue: "",
      normalizedName: this.normalizer.normalizeText(attribute),
      normalizedValue: "",
      operator: "contains",
    };
  }

  private cleanProductName(name: string): string {
    return name.replace(/\s*\([^)]*\)/g, "").trim();
  }

  private frequentBrandToken(products: KnowledgeBase["products"]): string | null {
    const counts = new Map<string, number>();
    for (const product of products) {
      const tokens = new Set(
        this.normalizer
          .normalizeText(product.name)
          .split(" ")
          .filter(
            (token) =>
              token.length > 2 &&
              /^[a-z]+$/.test(token) &&
              !this.BRAND_STOPWORDS.has(token),
          ),
      );
      for (const token of tokens) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [token, count] of counts) {
      if (count > bestCount) {
        best = token;
        bestCount = count;
      }
    }
    return bestCount >= MIN_PRODUCTS_FOR_BRAND_FALLBACK ? best : null;
  }

  private generateSpecQuestions(
    knowledge: KnowledgeBase,
    categoryId: string,
  ): GeoQuestion[] {
    const category = this.getCategory(knowledge, categoryId);
    if (!category) {
      return [];
    }
    const categoryProducts = knowledge.products.filter(
      (product) => product.categoryId === categoryId,
    );
    if (categoryProducts.length === 0) {
      return [];
    }
    const attributes = expectedAttributesForCategory(category.name);
    const probes = attributes.length > 0
      ? attributes.slice(0, MAX_SPEC_PROBES)
      : ["Especificações"];

    return probes.map((attribute, index) => ({
      id: `${categoryId}:spec:${index + 1}`,
      categoryId,
      categoryName: category.name,
      persona: "spec",
      text: `Quais ${category.name.toLowerCase()} informam ${attribute.toLowerCase()} em dados estruturados?`,
      constraints: [
        this.presenceConstraint(attribute),
      ],
    }));
  }

  private generatePriceQuestions(
    knowledge: KnowledgeBase,
    categoryId: string,
  ): GeoQuestion[] {
    const category = this.getCategory(knowledge, categoryId);
    if (!category) {
      return [];
    }
    const pricedProducts = knowledge.products
      .filter((product) => product.categoryId === categoryId)
      .map((product) => ({ product, price: parseBrlPrice(product.price) }))
      .filter((item): item is { product: (typeof item)["product"]; price: number } =>
        item.price !== null,
      )
      .sort((a, b) => a.price - b.price);

    if (pricedProducts.length === 0) {
      return [];
    }

    const medianIndex = Math.floor((pricedProducts.length - 1) / 2);
    const budget = pricedProducts[medianIndex].price;
    const budgetLabel = budget.toLocaleString("pt-BR");

    return [
      {
        id: `${categoryId}:price:1`,
        categoryId,
        categoryName: category.name,
        persona: "price",
        text: `Qual ${category.name.toLowerCase()} oferece o melhor custo-benefício por até R$ ${budgetLabel}?`,
        constraints: [
          {
            attributeName: "Preço",
            attributeValue: String(budget),
            normalizedName: "preco",
            normalizedValue: String(budget),
            operator: "lte",
          },
        ],
      },
    ];
  }

  private generateBrandQuestions(
    knowledge: KnowledgeBase,
    categoryId: string,
  ): GeoQuestion[] {
    const category = this.getCategory(knowledge, categoryId);
    if (!category) {
      return [];
    }
    const categoryProductIds = category.productIds;
    const brand = knowledge.brands.find((item) =>
      item.productIds.some((productId) =>
        categoryProductIds.includes(productId),
      ),
    );
    if (!brand) {
      return [];
    }
    const brandProductIds = brand.productIds.filter((productId) =>
      categoryProductIds.includes(productId),
    );
    const brandAttribute = knowledge.attributes
      .filter((attribute) =>
        attribute.productIds.some((productId) =>
          brandProductIds.includes(productId),
        ),
      )
      .slice(0, 1)[0];

    const questionText = brandAttribute
      ? `Qual ${category.name.toLowerCase()} da marca ${brand.name} possui ${brandAttribute.name.toLowerCase()} ${brandAttribute.value.toLowerCase()}?`
      : `Qual ${category.name.toLowerCase()} da marca ${brand.name} você recomenda?`;

    const constraints: QuestionConstraint[] = [
      {
        attributeName: "Marca",
        attributeValue: brand.name,
        normalizedName: "marca",
        normalizedValue: brand.normalizedName,
        operator: "equals",
      },
    ];
    if (brandAttribute) {
      constraints.push({
        attributeName: brandAttribute.name,
        attributeValue: brandAttribute.value,
        normalizedName: brandAttribute.normalizedName,
        normalizedValue: brandAttribute.normalizedValue,
        operator: "contains",
      });
    }

    return [
      {
        id: `${categoryId}:brand:1`,
        categoryId,
        categoryName: category.name,
        persona: "brand",
        text: questionText,
        constraints,
      },
    ];
  }

  private generateCompareQuestions(
    knowledge: KnowledgeBase,
    categoryId: string,
  ): GeoQuestion[] {
    const category = this.getCategory(knowledge, categoryId);
    if (!category) {
      return [];
    }
    const categoryProducts = knowledge.products.filter(
      (product) => product.categoryId === categoryId,
    );
    if (categoryProducts.length < 2) {
      return [];
    }
    const attributes = expectedAttributesForCategory(category.name);
    const attribute = attributes[0] ?? "Especificações";
    const productA = categoryProducts[0];
    const productB = categoryProducts[1];

    return [
      {
        id: `${categoryId}:compare:1`,
        categoryId,
        categoryName: category.name,
        persona: "compare",
        text: `Entre ${this.cleanProductName(productA.name)} e ${this.cleanProductName(productB.name)}, qual informa ${attribute.toLowerCase()} em dados estruturados?`,
        constraints: [
          this.presenceConstraint(attribute),
        ],
        candidateProductIds: [productA.id, productB.id],
      },
    ];
  }
}
