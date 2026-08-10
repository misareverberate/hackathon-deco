import type { Page } from "../models.js";

export function normalizeUrl(input: string, baseUrl: string): string {
  try {
    if (/^https?:\/\//i.test(input)) {
      return new URL(input).toString();
    }

    return new URL(input, baseUrl).toString();
  } catch {
    return input;
  }
}

const PRODUCT_PATH_MARKERS = [/\/product\//i, /\/produto\//i, /\/p\//i];
const CATEGORY_PATH_MARKERS = [/\/category\//i, /\/categoria\//i, /\/c\//i];

const MEGA_MENU_SEGMENT =
  /^(jet[-_ ]menu|elementor[-_ ]mega[-_ ]item|mega[-_ ]item)/i;

const PRODUCT_SLUG_SUFFIX = /-[a-z]?\d+(-\d+)?$/i;
const PRODUCT_TOKEN_TAIL = /-[a-z0-9]*\d+[a-z0-9]*$/i;
const HTML_EXTENSION = /\.html?$/i;
const NON_HTML_EXTENSION = /\.\w{2,5}$/;
const MIN_PRODUCT_HYPHENS = 2;
const MIN_PRODUCT_HYPHENS_TAIL = 3;

const INSTITUTIONAL_WORDS = new Set([
  "about",
  "sobre",
  "contato",
  "contact",
  "politica",
  "policy",
  "termos",
  "terms",
  "privacidade",
  "privacy",
  "faq",
  "ajuda",
  "help",
  "suporte",
  "support",
  "atendimento",
  "garantia",
  "warranty",
  "carrinho",
  "cart",
  "checkout",
  "conta",
  "account",
  "login",
  "cadastro",
  "registro",
  "register",
  "trocas",
  "devolucao",
  "reembolso",
  "pagamento",
  "entrega",
  "envio",
  "frete",
  "institucional",
  "quem-somos",
  "imprensa",
  "blog",
  "duvidas",
  "juridico",
  "trabalhe-conosco",
  "nossas-lojas",
  "fornecedores",
  "afiliados",
]);

const UTILITY_WORDS = new Set([
  "marca",
  "brand",
  "busca",
  "search",
  "departamentos",
  "novidades",
  "destaques",
  "promocao",
  "promocoes",
  "ofertas",
  "lancamentos",
  "lancamento",
  "wishlist",
  "favoritos",
  "cupom",
  "desconto",
  "teste",
  "test",
  "pagina",
  "page",
  "sitemap",
  "jet",
  "mega",
]);

function pathSegments(pathname: string): string[] {
  return pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
}

function segmentWords(segment: string): string[] {
  return segment.toLowerCase().split(/[-_]/);
}

function matchesAny(segment: string, words: Set<string>): boolean {
  return segmentWords(segment).some((word) => words.has(word));
}

function looksLikeProductSlug(segment: string): boolean {
  if (HTML_EXTENSION.test(segment)) {
    return true;
  }
  if (NON_HTML_EXTENSION.test(segment)) {
    return false;
  }
  const hyphens = (segment.match(/-/g) ?? []).length;
  if (hyphens >= MIN_PRODUCT_HYPHENS && PRODUCT_SLUG_SUFFIX.test(segment)) {
    return true;
  }
  return (
    hyphens >= MIN_PRODUCT_HYPHENS_TAIL &&
    PRODUCT_TOKEN_TAIL.test(segment)
  );
}

function matchesAnyPathMarker(pathname: string, markers: RegExp[]): boolean {
  return markers.some((marker) => marker.test(pathname));
}

export function classifyUrl(url: string): Page["type"] {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url;
  }
  const lower = pathname.toLowerCase();

  if (lower === "/" || lower === "") {
    return "homepage";
  }

  if (matchesAnyPathMarker(lower, PRODUCT_PATH_MARKERS)) {
    return "product";
  }

  const segments = pathSegments(pathname);
  if (segments.some((segment) => MEGA_MENU_SEGMENT.test(segment))) {
    return "unknown";
  }
  if (looksLikeProductSlug(segments.at(-1) ?? "")) {
    return "product";
  }

  if (matchesAnyPathMarker(lower, CATEGORY_PATH_MARKERS)) {
    return "category";
  }

  if (segments.some((segment) => matchesAny(segment, INSTITUTIONAL_WORDS))) {
    return "institutional";
  }

  if (segments.some((segment) => matchesAny(segment, UTILITY_WORDS))) {
    return "unknown";
  }

  if (segments.some((segment) => NON_HTML_EXTENSION.test(segment))) {
    return "unknown";
  }

  const lastSegment = segments.at(-1) ?? "";
  const flat = segments.length <= 1;
  if (flat && /\d/.test(lastSegment)) {
    return "unknown";
  }

  return "category";
}

export function isSameHost(url: string, baseUrl: string): boolean {
  try {
    return new URL(url).host === new URL(baseUrl).host;
  } catch {
    return false;
  }
}
