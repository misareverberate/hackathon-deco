import type { KnowledgeBase } from "../../knowledge/knowledgeBuilder.js";
import type { SchemaEntity } from "../../knowledge/entityResolver.js";
import type {
  Opportunity,
  OpportunityReport,
} from "../../recommendation/types.js";
import { IMPACT_WEIGHTS } from "../../recommendation/types.js";

type RuleScope = "product" | "category" | "page" | "site" | "global";

interface RuleResult {
  scope: RuleScope;
  opportunity: Opportunity;
}

export class OpportunityAnalyzer {
  analyze(knowledge: KnowledgeBase): OpportunityReport {
    const results = [
      this.seoTitleMissing(knowledge),
      this.seoDescriptionMissing(knowledge),
      this.seoCanonicalMissing(knowledge),
      this.schemaProductMissing(knowledge),
      this.schemaProductIncomplete(knowledge),
      this.schemaEntityMissing(knowledge),
      this.geoAttributesMissing(knowledge),
      this.conteudoDescriptionMissing(knowledge),
      this.conteudoFaqMissing(knowledge),
      this.conteudoInstitutionalMissing(knowledge),
      this.produtoPriceMissing(knowledge),
      this.produtoBrandMissing(knowledge),
      this.produtoCategoryMissing(knowledge),
    ].filter((result): result is RuleResult => result !== null);

    const opportunities = results.map((result) => result.opportunity);
    const totalProducts = knowledge.products.length;
    const totalPages = knowledge.pages.length;

    return {
      site: {
        baseUrl: knowledge.site.baseUrl,
        host: knowledge.site.host,
        title: knowledge.site.title,
      },
      opportunities,
      healthScore: this.calculateHealthScore(
        results,
        totalProducts,
        totalPages,
      ),
    };
  }

  private calculateHealthScore(
    results: RuleResult[],
    totalProducts: number,
    totalPages: number,
  ): number {
    let penalty = 0;
    for (const result of results) {
      const { opportunity, scope } = result;
      const denominator =
        scope === "product"
          ? totalProducts
          : scope === "page"
            ? totalPages
            : 1;
      const affected = Math.max(1, opportunity.affectedProducts ?? 1);
      const fraction =
        denominator === 0 ? 1 : Math.min(1, affected / denominator);
      const weight = IMPACT_WEIGHTS[opportunity.impact];
      const confidence = this.clamp(opportunity.confidence, 0, 100) / 100;
      penalty += weight * confidence * 25 * fraction;
    }
    return this.clamp(100 - Math.round(penalty), 0, 100);
  }

  private seoTitleMissing(knowledge: KnowledgeBase): RuleResult | null {
    const affectedPages = knowledge.pages.filter((page) => !page.title);
    if (affectedPages.length === 0) {
      return null;
    }
    return {
      scope: "page",
      opportunity: {
        id: "op:seo-title",
        scope: "page",
        title: "Título ausente em páginas",
        description: `${affectedPages.length} página(s) sem tag <title>.`,
        category: "SEO",
        priority: "alta",
        impact: "medio",
        confidence: 100,
        effort: "muito_baixo",
        automatable: true,
        affectedProducts: affectedPages.length,
        affectedItems: this.sampleItems(
          affectedPages.map((page) => page.title ?? page.url),
          10,
        ),
        reason:
          "O <title> é o principal sinal on-page que informa aos buscadores o assunto da página; sem ele o ranqueamento e o CTR caem.",
      },
    };
  }

  private seoDescriptionMissing(knowledge: KnowledgeBase): RuleResult | null {
    const affectedPages = knowledge.pages.filter((page) => !page.description);
    if (affectedPages.length === 0) {
      return null;
    }
    return {
      scope: "page",
      opportunity: {
        id: "op:seo-description",
        scope: "page",
        title: "Meta description ausente em páginas",
        description: `${affectedPages.length} página(s) sem meta description.`,
        category: "SEO",
        priority: "media",
        impact: "medio",
        confidence: 95,
        effort: "muito_baixo",
        automatable: true,
        affectedProducts: affectedPages.length,
        affectedItems: this.sampleItems(
          affectedPages.map((page) => page.title ?? page.url),
          10,
        ),
        reason:
          "A meta description define o trecho exibido nos resultados de busca e influencia diretamente a taxa de cliques.",
      },
    };
  }

  private seoCanonicalMissing(knowledge: KnowledgeBase): RuleResult | null {
    const affectedPages = knowledge.pages.filter((page) => !page.canonical);
    if (affectedPages.length === 0) {
      return null;
    }
    return {
      scope: "page",
      opportunity: {
        id: "op:seo-canonical",
        scope: "page",
        title: "Canonical ausente em páginas",
        description: `${affectedPages.length} página(s) sem URL canônica.`,
        category: "SEO",
        priority: "media",
        impact: "medio",
        confidence: 90,
        effort: "muito_baixo",
        automatable: true,
        affectedProducts: affectedPages.length,
        affectedItems: this.sampleItems(
          affectedPages.map((page) => page.title ?? page.url),
          10,
        ),
        reason:
          "Sem canonical, versões duplicadas da página dividem a relevância e prejudicam o ranqueamento.",
      },
    };
  }

  private schemaProductMissing(knowledge: KnowledgeBase): RuleResult | null {
    const affectedProducts = knowledge.products.filter(
      (product) => product.schemaIds.length === 0,
    );
    if (affectedProducts.length === 0) {
      return null;
    }
    return {
      scope: "product",
      opportunity: {
        id: "op:schema-product",
        scope: "product",
        title: "Produtos sem schema Product",
        description: `${affectedProducts.length} produto(s) sem dados estruturados Product (JSON-LD).`,
        category: "Schema",
        priority: "critica",
        impact: "muito_alto",
        confidence: 100,
        effort: "baixo",
        automatable: true,
        affectedProducts: affectedProducts.length,
        affectedProductIds: affectedProducts.map((product) => product.id),
        affectedItems: this.sampleItems(
          affectedProducts.map((product) => product.name),
          10,
        ),
        reason:
          "Dados estruturados Product habilitam rich results com preço, disponibilidade e avaliações nos resultados de busca.",
      },
    };
  }

  private schemaProductIncomplete(knowledge: KnowledgeBase): RuleResult | null {
    const schemaById = new Map(knowledge.schemas.map((schema) => [schema.id, schema]));
    const affectedProducts = knowledge.products.filter((product) => {
      if (product.schemaIds.length === 0) {
        return false;
      }
      const productSchemas = product.schemaIds
        .map((id) => schemaById.get(id))
        .filter((schema): schema is SchemaEntity => schema !== undefined);
      return !productSchemas.some(
        (schema) =>
          this.isProductSchema(schema) &&
          this.hasSchemaProperty(schema, "offers") &&
          this.hasSchemaProperty(schema, "aggregateRating") &&
          this.hasSchemaProperty(schema, "brand"),
      );
    });
    if (affectedProducts.length === 0) {
      return null;
    }
    return {
      scope: "product",
      opportunity: {
        id: "op:schema-incomplete",
        scope: "product",
        title: "Schema Product incompleto",
        description: `${affectedProducts.length} produto(s) com schema Product sem offers, aggregateRating ou brand.`,
        category: "Schema",
        priority: "alta",
        impact: "alto",
        confidence: 90,
        effort: "baixo",
        automatable: true,
        affectedProducts: affectedProducts.length,
        affectedProductIds: affectedProducts.map((product) => product.id),
        affectedItems: this.sampleItems(
          affectedProducts.map((product) => product.name),
          10,
        ),
        reason:
          "Rich results de produto dependem das propriedades offers, aggregateRating e brand no JSON-LD.",
      },
    };
  }

  private schemaEntityMissing(knowledge: KnowledgeBase): RuleResult | null {
    const hasEntitySchema = knowledge.schemas.some(
      (schema) =>
        this.getSchemaType(schema) === "Organization" ||
        this.getSchemaType(schema) === "WebSite",
    );
    if (hasEntitySchema) {
      return null;
    }
    return {
      scope: "site",
      opportunity: {
        id: "op:schema-entity",
        scope: "site",
        title: "Schema Organization/WebSite ausente",
        description:
          "Nenhum schema Organization ou WebSite encontrado no site.",
        category: "Schema",
        priority: "media",
        impact: "medio",
        confidence: 85,
        effort: "baixo",
        automatable: true,
        affectedProducts: Math.max(1, knowledge.products.length),
        affectedProductIds: knowledge.products.map((product) => product.id),
        reason:
          "Schema Organization/WebSite permite aos buscadores associar marca, logo e breadcrumb, fortalecendo a identidade do site.",
      },
    };
  }

  private geoAttributesMissing(knowledge: KnowledgeBase): RuleResult | null {
    const affectedProducts = knowledge.products.filter(
      (product) => product.attributes.length === 0,
    );
    if (affectedProducts.length === 0) {
      return null;
    }
    return {
      scope: "product",
      opportunity: {
        id: "op:geo-attributes",
        scope: "product",
        title: "Atributos insuficientes para busca generativa",
        description: `${affectedProducts.length} produto(s) sem atributos técnicos (peso, dimensões, material etc.).`,
        category: "GEO",
        priority: "alta",
        impact: "alto",
        confidence: 90,
        effort: "medio",
        automatable: false,
        affectedProducts: affectedProducts.length,
        affectedProductIds: affectedProducts.map((product) => product.id),
        affectedItems: this.sampleItems(
          affectedProducts.map((product) => product.name),
          10,
        ),
        reason:
          "Assistentes generativos respondem com base em atributos estruturados; sem eles o catálogo não é citado em respostas de compra.",
      },
    };
  }

  private conteudoDescriptionMissing(
    knowledge: KnowledgeBase,
  ): RuleResult | null {
    const affectedProducts = knowledge.products.filter(
      (product) => !product.description,
    );
    if (affectedProducts.length === 0) {
      return null;
    }
    return {
      scope: "product",
      opportunity: {
        id: "op:conteudo-description",
        scope: "product",
        title: "Descrições de produto ausentes",
        description: `${affectedProducts.length} produto(s) sem descrição.`,
        category: "Conteudo",
        priority: "media",
        impact: "medio",
        confidence: 95,
        effort: "medio",
        automatable: true,
        affectedProducts: affectedProducts.length,
        affectedProductIds: affectedProducts.map((product) => product.id),
        affectedItems: this.sampleItems(
          affectedProducts.map((product) => product.name),
          10,
        ),
        reason:
          "Descrições únicas e completas ajudam o ranqueamento orgânico e a decisão de compra.",
      },
    };
  }

  private conteudoFaqMissing(knowledge: KnowledgeBase): RuleResult | null {
    if (knowledge.faqs.length > 0) {
      return null;
    }
    return {
      scope: "site",
      opportunity: {
        id: "op:conteudo-faq",
        scope: "site",
        title: "Sem conteúdo de FAQ estruturado",
        description:
          "Nenhuma FAQ estruturada encontrada para as dúvidas frequentes.",
        category: "Conteudo",
        priority: "media",
        impact: "alto",
        confidence: 85,
        effort: "baixo",
        automatable: true,
        affectedProducts: Math.max(1, knowledge.products.length),
        affectedProductIds: knowledge.products.map((product) => product.id),
        reason:
          "FAQs respondem dúvidas comuns, alimentam rich results e aumentam a chance de citação em buscas generativas.",
      },
    };
  }

  private conteudoInstitutionalMissing(
    knowledge: KnowledgeBase,
  ): RuleResult | null {
    const institutional = knowledge.pages.filter(
      (page) => page.type === "institutional",
    ).length;
    if (institutional > 0) {
      return null;
    }
    return {
      scope: "site",
      opportunity: {
        id: "op:conteudo-institutional",
        scope: "site",
        title: "Páginas institucionais ausentes",
        description:
          "Nenhuma página institucional (sobre, contato, política) detectada.",
        category: "Conteudo",
        priority: "media",
        impact: "medio",
        confidence: 80,
        effort: "medio",
        automatable: false,
        affectedProducts: Math.max(1, knowledge.products.length),
        affectedProductIds: knowledge.products.map((product) => product.id),
        reason:
          "Páginas institucionais transmitem confiança (E-E-A-T) e são fonte de respostas para buscas por marca.",
      },
    };
  }

  private produtoPriceMissing(knowledge: KnowledgeBase): RuleResult | null {
    const affectedProducts = knowledge.products.filter((product) => !product.price);
    if (affectedProducts.length === 0) {
      return null;
    }
    return {
      scope: "product",
      opportunity: {
        id: "op:produto-price",
        scope: "product",
        title: "Produtos sem preço",
        description: `${affectedProducts.length} produto(s) sem preço informado.`,
        category: "Produto",
        priority: "critica",
        impact: "muito_alto",
        confidence: 100,
        effort: "baixo",
        automatable: true,
        affectedProducts: affectedProducts.length,
        affectedProductIds: affectedProducts.map((product) => product.id),
        affectedItems: this.sampleItems(
          affectedProducts.map((product) => product.name),
          10,
        ),
        reason:
          "O preço é determinante para conversão e para os rich results de Product com offers.",
      },
    };
  }

  private produtoBrandMissing(knowledge: KnowledgeBase): RuleResult | null {
    const affectedProducts = knowledge.products.filter((product) => !product.brand);
    if (affectedProducts.length === 0) {
      return null;
    }
    return {
      scope: "product",
      opportunity: {
        id: "op:produto-brand",
        scope: "product",
        title: "Produtos sem marca",
        description: `${affectedProducts.length} produto(s) sem marca identificada.`,
        category: "Produto",
        priority: "alta",
        impact: "alto",
        confidence: 100,
        effort: "baixo",
        automatable: false,
        affectedProducts: affectedProducts.length,
        affectedProductIds: affectedProducts.map((product) => product.id),
        affectedItems: this.sampleItems(
          affectedProducts.map((product) => product.name),
          10,
        ),
        reason:
          "A marca agrega confiança, é fator de decisão de compra e faz parte do schema Product.",
      },
    };
  }

  private produtoCategoryMissing(knowledge: KnowledgeBase): RuleResult | null {
    const affectedProducts = knowledge.products.filter((product) => !product.category);
    if (affectedProducts.length === 0) {
      return null;
    }
    return {
      scope: "product",
      opportunity: {
        id: "op:produto-category",
        scope: "product",
        title: "Produtos sem categoria",
        description: `${affectedProducts.length} produto(s) sem categoria atribuída.`,
        category: "Produto",
        priority: "alta",
        impact: "alto",
        confidence: 100,
        effort: "medio",
        automatable: false,
        affectedProducts: affectedProducts.length,
        affectedProductIds: affectedProducts.map((product) => product.id),
        affectedItems: this.sampleItems(
          affectedProducts.map((product) => product.name),
          10,
        ),
        reason:
          "Categorias organizam navegação, breadcrumb e o ranqueamento das coleções.",
      },
    };
  }

  private isProductSchema(schema: SchemaEntity): boolean {
    return this.getSchemaType(schema) === "Product";
  }

  private getSchemaType(schema: SchemaEntity): string {
    const type = schema.raw["@type"];
    if (typeof type === "string") {
      return type;
    }
    if (Array.isArray(type)) {
      const found = type.find((entry) => typeof entry === "string");
      if (typeof found === "string") {
        return found;
      }
    }
    return schema.type;
  }

  private hasSchemaProperty(
    schema: SchemaEntity,
    property: string,
  ): boolean {
    const raw = schema.raw;
    if (property in raw) {
      return true;
    }
    const graph = raw["@graph"];
    if (Array.isArray(graph)) {
      return graph.some(
        (node) =>
          node !== null &&
          typeof node === "object" &&
          property in (node as Record<string, unknown>),
      );
    }
    return false;
  }

  private sampleItems(items: string[], max: number): string[] {
    const sampled = items.slice(0, max);
    const remaining = items.length - sampled.length;
    if (remaining > 0) {
      sampled.push(`+${remaining} outro(s)`);
    }
    return sampled;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
