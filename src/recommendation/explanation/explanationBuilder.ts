import type { ImpactConfig } from "../config/impactConfig.js";
import type {
  EvidenceSource,
  ExplanationInput,
  MetricExplanation,
  RationalePoint,
} from "../types.js";
import { EVIDENCE_SOURCE_LABELS } from "../evidence.js";

export interface ExplanationSpec {
  metric: string;
  summary: string;
  formula: string;
  inputs?: ExplanationInput[];
  rationale?: RationalePoint[];
  assumptions?: string[];
}

export function explanation(
  spec: ExplanationSpec,
  config: ImpactConfig,
): MetricExplanation {
  return {
    metric: spec.metric,
    summary: spec.summary,
    formula: spec.formula,
    inputs: (spec.inputs ?? []).map((input) => ({
      ...input,
      contribution:
        input.value !== undefined && input.weight !== undefined
          ? round3(input.value * input.weight)
          : input.contribution,
    })),
    rationale: spec.rationale ?? [],
    assumptions: spec.assumptions ?? [],
    modelVersion: config.version,
  };
}

export function input(
  key: string,
  label: string,
  display: string,
  value?: number,
  weight?: number,
): ExplanationInput {
  return { key, label, display, value, weight };
}

export function rationale(
  kind: RationalePoint["kind"],
  source: EvidenceSource | undefined,
  label?: string,
): RationalePoint {
  return {
    kind,
    source,
    label: label ?? sourceLabel(source),
  };
}

export function supporting(source: EvidenceSource): RationalePoint {
  return rationale("supporting", source);
}

export function missing(source: EvidenceSource): RationalePoint {
  return rationale("missing", source, `✗ ${EVIDENCE_SOURCE_LABELS[source]} não conectado`);
}

export function warning(label: string): RationalePoint {
  return rationale("warning", undefined, label);
}

function sourceLabel(source: EvidenceSource | undefined): string {
  return source ? `✓ ${EVIDENCE_SOURCE_LABELS[source]} disponível` : "";
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
