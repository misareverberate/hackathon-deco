import { ConcreteAction, Opportunity } from "./types.js";
import type { KnowledgeBase } from "../knowledge/knowledgeBuilder.js";

export class ActionGenerator {
  generate(opportunity: Opportunity, knowledge: KnowledgeBase): ConcreteAction {
    const context = `${opportunity.title} ${opportunity.description}`.toLowerCase();

    if (context.includes("faq")) {
      return this.faqAction(knowledge);
    }

    if (opportunity.category === "Schema" || context.includes("schema")) {
      return this.schemaAction();
    }

    if (opportunity.category === "Produto") {
      return this.productAction();
    }

    switch (opportunity.category) {
      case "SEO":
        return this.seoAction();
      case "GEO":
        return this.geoAction(knowledge);
      case "Conteudo":
        return this.contentAction(knowledge);
      default:
        return this.genericAction(opportunity);
    }
  }

  private faqAction(knowledge: KnowledgeBase): ConcreteAction {
    return {
      title: "Gerar FAQ estruturado",
      description:
        "Produzir perguntas e respostas com base nas dúvidas frequentes e no catálogo, publicadas com schema FAQPage.",
      steps: [
        "Coletar dúvidas recorrentes a partir do catálogo e conteúdo existente",
        `Gerar conteúdo para as ${knowledge.faqs.length} FAQs atuais com IA`,
        "Marcar as perguntas com schema FAQPage",
        "Publicar e validar a estrutura",
      ],
    };
  }

  private schemaAction(): ConcreteAction {
    return {
      title: "Completar schema de produto",
      description:
        "Enriquecer o JSON-LD de Product com as propriedades ausentes para melhorar a interpretação por mecanismos de busca e IA.",
      steps: [
        "Adicionar propriedade brand",
        "Adicionar propriedade offers (preço e disponibilidade)",
        "Adicionar propriedade aggregateRating",
        "Adicionar propriedade review",
      ],
    };
  }

  private productAction(): ConcreteAction {
    return {
      title: "Enriquecer atributos técnicos",
      description:
        "Padronizar e preencher atributos técnicos dos produtos para permitir perguntas de compra específicas.",
      steps: [
        "Adicionar peso",
        "Adicionar dimensões",
        "Adicionar material",
        "Adicionar capacidade",
        "Padronizar nomenclatura dos atributos",
      ],
    };
  }

  private seoAction(): ConcreteAction {
    return {
      title: "Corrigir elementos de SEO",
      description:
        "Ajustar metadados e marcação para melhorar visibilidade orgânica.",
      steps: [
        "Corrigir title e meta description",
        "Adicionar Open Graph e canonical",
        "Revisar headings e texto alternativo das imagens",
      ],
    };
  }

  private geoAction(knowledge: KnowledgeBase): ConcreteAction {
    return {
      title: "Melhorar prontidão para busca generativa",
      description:
        "Garantir que agentes de IA e mecanismos de busca consigam responder perguntas sobre o catálogo.",
      steps: [
        `Validar atributos estruturados em ${knowledge.products.length} produto(s)`,
        "Publicar FAQ estruturado",
        "Manter preço e disponibilidade consistentes",
      ],
    };
  }

  private contentAction(knowledge: KnowledgeBase): ConcreteAction {
    return {
      title: "Gerar conteúdo com IA",
      description:
        "Criar descrições e conteúdos ricos para o catálogo usando IA.",
      steps: [
        `Gerar descrições para ${knowledge.products.length} produto(s)`,
        "Revisar e aprovar os textos",
        "Publicar e monitorar a qualidade",
      ],
    };
  }

  private genericAction(opportunity: Opportunity): ConcreteAction {
    return {
      title: opportunity.title,
      description: opportunity.description,
      steps: [
        "Analisar o impacto e definir responsáveis",
        "Planejar a implementação",
        "Executar e validar o resultado",
      ],
    };
  }
}
