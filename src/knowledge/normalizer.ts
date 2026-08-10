export interface NormalizedValue {
  raw: string;
  normalized: string;
}

export class Normalizer {
  normalizeText(value: string): string {
    const compact = value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");

    return compact.replace(/(\d)\s+(tb|gb|mb|kb)/gi, "$1$2");
  }

  normalizeMeasure(value: string): string {
    return this.normalizeText(value);
  }

  normalizeAttributeName(name: string): string {
    return this.normalizeText(name);
  }

  normalizeAttributeValue(value: string): string {
    return this.normalizeMeasure(value);
  }

  normalizeProductName(name: string): string {
    return this.normalizeMeasure(name);
  }

  normalizeCategoryName(name: string): string {
    return this.normalizeText(name);
  }

  normalizeBrandName(name: string): string {
    return this.normalizeText(name);
  }
}
