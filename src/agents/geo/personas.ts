import type { BuyerPersona } from "./types.js";

export interface BuyerPersonaConfig {
  id: BuyerPersona;
  label: string;
  description: string;
  prompt: string;
}

export const BUYER_PERSONAS: BuyerPersonaConfig[] = [
  {
    id: "price",
    label: "Comparador de preço",
    description:
      "Busca o melhor custo-benefício dentro de um orçamento, comparando preços antes de decidir.",
    prompt:
      "Você é um comprador orientado por preço. Você pesquisa ativamente pelo melhor custo-benefício dentro do seu orçamento e só decide após comparar as opções disponíveis. Responda como um consumidor real de e-commerce.",
  },
  {
    id: "spec",
    label: "Comprador técnico",
    description:
      "Busca produtos que atendam exatamente a atributos técnicos específicos (memória, capacidade, tamanho).",
    prompt:
      "Você é um comprador técnico e detalhista. Você sabe exatamente quais atributos precisa e só se convence quando a ficha técnica do produto está completa e acessível. Responda como um consumidor real de e-commerce.",
  },
  {
    id: "brand",
    label: "Comprador fiel à marca",
    description:
      "Busca produtos de marcas confiáveis e desconfia de produtos sem marca ou de marcas desconhecidas.",
    prompt:
      "Você é um comprador fiel à marca. Você prioriza marcas reconhecidas e confiáveis, e fica hesitante diante de produtos sem marca ou com dados de marca ausentes. Responda como um consumidor real de e-commerce.",
  },
  {
    id: "compare",
    label: "Comprador comparador",
    description:
      "Compara alternativas lado a lado e decide qual produto vence em um atributo decisivo (memória, capacidade, potência).",
    prompt:
      "Você é um comprador comparador. Você coloca produtos concorrentes lado a lado e decide qual vence no atributo que considera decisivo. Só recomenda quando consegue comparar os dois com dados objetivos. Responda como um consumidor real de e-commerce.",
  },
];

export function getPersonaConfig(persona: BuyerPersona): BuyerPersonaConfig {
  const config = BUYER_PERSONAS.find((item) => item.id === persona);
  if (!config) {
    throw new Error(`Persona desconhecida: ${persona}`);
  }
  return config;
}
