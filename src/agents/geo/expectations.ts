import type { BuyerPersona } from "./types.js";

export interface CategoryExpectation {
  tokens: string[];
  attributes: string[];
}

export const CATEGORY_EXPECTATIONS: CategoryExpectation[] = [
  { tokens: ["notebook", "computador", "desktop"], attributes: ["Memória", "Processador", "Armazenamento", "Garantia"] },
  { tokens: ["monitor", "tv", "televisor"], attributes: ["Tamanho", "Resolução", "Taxa de atualização", "Garantia"] },
  { tokens: ["roupa", "camisa", "calça", "vestido"], attributes: ["Tamanho", "Material", "Cor", "Troca"] },
  { tokens: ["tênis", "tenis", "calçado", "calcado"], attributes: ["Tamanho", "Material", "Uso recomendado", "Troca"] },
  { tokens: ["móvel", "movel", "mesa", "cadeira"], attributes: ["Dimensões", "Material", "Peso suportado", "Garantia"] },
  { tokens: ["eletrodoméstico", "eletrodomestico"], attributes: ["Voltagem", "Dimensões", "Consumo", "Garantia"] },
];

export const DEFAULT_CATEGORY_ATTRIBUTES = ["Disponibilidade", "Garantia", "Troca"];

export function expectedAttributesForCategory(categoryName: string): string[] {
  const normalized = categoryName.toLocaleLowerCase("pt-BR");
  return CATEGORY_EXPECTATIONS.find(({ tokens }) =>
    tokens.some((token) => normalized.includes(token)),
  )?.attributes ?? DEFAULT_CATEGORY_ATTRIBUTES;
}

export const PERSONA_EXPECTATIONS: Record<BuyerPersona, string[]> = {
  price: ["Preço", "Disponibilidade"],
  spec: ["Especificações", "Disponibilidade"],
  brand: ["Marca", "Garantia"],
  compare: ["Preço", "Especificações"],
};
