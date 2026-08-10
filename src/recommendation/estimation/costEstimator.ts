import type { CostEstimate, Opportunity } from "../types.js";
import type { ImpactConfig } from "../config/impactConfig.js";
import { explanation, input } from "../explanation/explanationBuilder.js";

export class CostEstimator {
  estimate(config: ImpactConfig, opportunity: Opportunity): CostEstimate {
    const { hoursPerTask, laborCostPerHour, taskFrequencyPerYear, currency } =
      config.assumptions;

    if (!opportunity.automatable) {
      return {
        low: 0,
        high: 0,
        currency,
        explanation: this.explainManual(config),
      };
    }

    const isSiteScope = opportunity.scope === "site";
    const count = isSiteScope
      ? 1
      : Math.max(0, opportunity.affectedProducts ?? 1);
    const hoursPerYearLow = count * hoursPerTask * 0.8 * taskFrequencyPerYear;
    const hoursPerYearHigh = count * hoursPerTask * 1.2 * taskFrequencyPerYear;
    const low = Math.round(hoursPerYearLow * laborCostPerHour);
    const high = Math.round(hoursPerYearHigh * laborCostPerHour);

    return {
      low,
      high,
      currency,
      explanation: this.explain(
        config,
        count,
        hoursPerTask,
        laborCostPerHour,
        taskFrequencyPerYear,
        hoursPerYearLow,
        hoursPerYearHigh,
        low,
        high,
        isSiteScope,
      ),
    };
  }

  private explain(
    config: ImpactConfig,
    count: number,
    hoursPerTask: number,
    laborCostPerHour: number,
    taskFrequencyPerYear: number,
    hoursPerYearLow: number,
    hoursPerYearHigh: number,
    low: number,
    high: number,
    isSiteScope: boolean,
  ): CostEstimate["explanation"] {
    const { currency } = config.assumptions;
    return explanation(
      {
        metric: "costAvoided",
        summary: `Custo evitado de ${this.currency(low, currency)} a ${this.currency(high, currency)}/ano com mão de obra automatizável.`,
        formula: isSiteScope
          ? "custo evitado = 1 tarefa (escopo site) × horas por tarefa × frequência/ano × custo por hora"
          : "custo evitado = produtos afetados × horas por tarefa × frequência/ano × custo por hora",
        inputs: [
          input(
            "affected",
            isSiteScope ? "Tarefas (escopo site)" : "Produtos afetados",
            String(count),
            count,
          ),
          input(
            "hoursPerTask",
            "Horas por tarefa",
            String(hoursPerTask),
            hoursPerTask,
          ),
          input(
            "frequency",
            "Frequência (vezes/ano)",
            String(taskFrequencyPerYear),
            taskFrequencyPerYear,
          ),
          input(
            "laborCost",
            "Custo da mão de obra/hora",
            this.currency(laborCostPerHour, currency),
            laborCostPerHour,
          ),
        ],
        assumptions: [
          "Horas por tarefa varia ±20% (tempo por item) entre baixo/alto.",
          "Ação automatizável substitui trabalho manual recorrente, repetido taskFrequencyPerYear vezes ao ano.",
          "Oportunidades de escopo site contam como uma única tarefa (1 item), independente do tamanho do catálogo.",
          "Ações manuais não geram custo evitado.",
        ],
      },
      config,
    );
  }

  private explainManual(config: ImpactConfig): CostEstimate["explanation"] {
    return explanation(
      {
        metric: "costAvoided",
        summary: "Sem custo evitado: ação manual não é automatizável.",
        formula: "custo evitado = 0 para ações manuais",
        inputs: [],
        assumptions: [
          "Ações manuais exigem intervenção humana e não entram no cálculo de automação.",
        ],
      },
      config,
    );
  }

  private currency(value: number, currency: string): string {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  }
}
