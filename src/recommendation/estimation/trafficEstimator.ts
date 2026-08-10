import type { TrafficEstimate, TrafficRange } from "../types.js";
import type { ImpactConfig } from "../config/impactConfig.js";
import { explanation, input } from "../explanation/explanationBuilder.js";

export interface TrafficResult {
  perMonth: TrafficRange;
  perYear: TrafficRange;
}

export class TrafficEstimator {
  estimate(
    config: ImpactConfig,
    affectedProducts: number | undefined,
    denominator: number,
    opportunityId?: string,
  ): TrafficEstimate {
    if (denominator <= 0 || (affectedProducts ?? 0) <= 0) {
      return {
        perMonth: { low: 0, high: 0 },
        perYear: { low: 0, high: 0 },
        explanation: this.explainZero(config),
      };
    }

    const count = Math.max(1, affectedProducts ?? 0);
    const coverage = Math.min(1, count / denominator);
    const months = Math.max(1, config.assumptions.monthsPerYear);

    const monthlySessions = config.assumptions.monthlyOrganicSessions;
    const lift = this.organicLift(config, opportunityId);
    if (monthlySessions !== undefined && monthlySessions > 0) {
      const low = monthlySessions * coverage * lift.min;
      const high = monthlySessions * coverage * lift.max;
      const perMonth = { low: Math.round(low), high: Math.round(high) };
      const perYear = {
        low: Math.round(low * months),
        high: Math.round(high * months),
      };
      return {
        perMonth,
        perYear,
        explanation: this.explainAnchored(
          config,
          count,
          denominator,
          coverage,
          monthlySessions,
          months,
          lift,
        ),
      };
    }

    const base = config.assumptions.organicOpportunityIndex * denominator;
    const low = base * coverage * lift.min;
    const high = base * coverage * lift.max;

    const perMonth = { low: Math.round(low), high: Math.round(high) };
    const perYear = {
      low: Math.round(low * months),
      high: Math.round(high * months),
    };

    return {
      perMonth,
      perYear,
      explanation: this.explain(
        config,
        count,
        denominator,
        coverage,
        base,
        months,
        lift,
      ),
    };
  }

  private explainAnchored(
    config: ImpactConfig,
    count: number,
    denominator: number,
    coverage: number,
    monthlySessions: number,
    months: number,
    lift: { min: number; max: number },
  ): TrafficEstimate["explanation"] {
    return explanation(
      {
        metric: "traffic",
        summary: `Estimativa de ${this.number(count)} produto(s) em ${denominator} → cobertura ${this.percent(coverage)}, ancorada em ${this.number(monthlySessions)} sessões orgânicas/mês informadas pelo cliente.`,
        formula:
          "sessões/mês = sessões orgânicas mensais × cobertura × hipótese de ganho; sessões/ano = sessões/mês × meses",
        inputs: [
          input(
            "monthlySessions",
            "Sessões orgânicas/mês",
            this.number(monthlySessions),
            monthlySessions,
          ),
          input("denominator", "Denominador", String(denominator), denominator),
          input("coverage", "Cobertura", this.percent(coverage), coverage),
          input("ctrLiftMin", "Ganho orgânico (min)", this.percent(lift.min), lift.min),
          input("ctrLiftMax", "Ganho orgânico (max)", this.percent(lift.max), lift.max),
          input("months", "Meses/ano", String(months), months),
        ],
        assumptions: [
          "O volume base é o dado de sessões orgânicas mensais informado pelo cliente.",
          "A faixa de ganho é uma hipótese específica para o tipo de recomendação, não uma previsão.",
          "Deve ser validada com Search Console, Analytics ou experimento controlado.",
        ],
      },
      config,
    );
  }

  private explain(
    config: ImpactConfig,
    count: number,
    denominator: number,
    coverage: number,
    base: number,
    months: number,
    lift: { min: number; max: number },
  ): TrafficEstimate["explanation"] {
    const a = config.assumptions;
    return explanation(
      {
        metric: "traffic",
        summary: `Estimativa de ${this.number(count)} produto(s) em ${denominator} → cobertura ${this.percent(coverage)}.`,
        formula:
          "sessões/ano = índice × denominador × cobertura × hipótese de ganho × meses",
        inputs: [
          input("index", "Índice de oportunidade", String(a.organicOpportunityIndex), a.organicOpportunityIndex),
          input("denominator", "Denominador", String(denominator), denominator),
          input("coverage", "Cobertura", this.percent(coverage), coverage),
          input("ctrLiftMin", "Ganho orgânico (min)", this.percent(lift.min), lift.min),
          input("ctrLiftMax", "Ganho orgânico (max)", this.percent(lift.max), lift.max),
          input("months", "Meses/ano", String(months), months),
        ],
        assumptions: [
          `Base de calibração: ${a.organicOpportunityIndex} × ${denominator} = ${Math.round(base)}.`,
          "Fallback sem dado do cliente: o índice de oportunidade orgânica é um fator de calibração, não sessões reais.",
          "Informe sessões orgânicas mensais na análise para ancorar a estimativa na operação real.",
          "A faixa de ganho é uma hipótese específica para o tipo de recomendação, não uma previsão.",
        ],
      },
      config,
    );
  }

  private explainZero(config: ImpactConfig): TrafficEstimate["explanation"] {
    return explanation(
      {
        metric: "traffic",
        summary: "Sem tráfego incremental estimado: sem produtos afetados ou sem denominador.",
        formula: "sessões/ano = 0 quando cobertura ou denominador é zero",
        inputs: [],
        assumptions: ["Ajuste affectedProducts ou o catálogo para estimar tráfego."],
      },
      config,
    );
  }

  private percent(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  private organicLift(
    config: ImpactConfig,
    opportunityId: string | undefined,
  ): { min: number; max: number } {
    const configured = opportunityId
      ? config.organicLiftByOpportunity[opportunityId]
      : undefined;
    const min = Math.max(0, configured?.min ?? config.assumptions.ctrLiftMin);
    const max = Math.max(min, configured?.max ?? config.assumptions.ctrLiftMax);
    return { min, max };
  }

  private number(value: number): string {
    return value.toLocaleString("pt-BR");
  }
}
