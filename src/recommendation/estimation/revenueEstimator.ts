import type { RevenueEstimate, TrafficRange } from "../types.js";
import type { ImpactConfig } from "../config/impactConfig.js";
import { explanation, input } from "../explanation/explanationBuilder.js";

export class RevenueEstimator {
  estimate(
    config: ImpactConfig,
    trafficPerYear: TrafficRange,
  ): RevenueEstimate {
    const { organicConversionRate, avgTicket, currency } =
      config.assumptions;
    const low = Math.round(
      trafficPerYear.low * organicConversionRate * avgTicket,
    );
    const high = Math.round(
      trafficPerYear.high * organicConversionRate * avgTicket,
    );
    return {
      low,
      high,
      currency,
      explanation: this.explain(
        config,
        trafficPerYear,
        organicConversionRate,
        avgTicket,
        low,
        high,
      ),
    };
  }

  private explain(
    config: ImpactConfig,
    trafficPerYear: TrafficRange,
    conversion: number,
    ticket: number,
    low: number,
    high: number,
  ): RevenueEstimate["explanation"] {
    const { currency } = config.assumptions;
    return explanation(
      {
        metric: "revenue",
        summary: `Receita incremental de ${this.currency(low, currency)} a ${this.currency(high, currency)}/ano.`,
        formula: "receita = sessões/ano × conversão × ticket médio",
        inputs: [
          input("sessionsLow", "Sessões (min)", String(trafficPerYear.low), trafficPerYear.low),
          input("sessionsHigh", "Sessões (max)", String(trafficPerYear.high), trafficPerYear.high),
          input("conversion", "Conversão orgânica", this.percent(conversion), conversion),
          input("ticket", "Ticket médio", this.currency(ticket, currency), ticket),
        ],
        assumptions: [
          "Conversão orgânica e ticket médio são premissas do setor, configuráveis por ambiente.",
          "Receita é um desdobramento do tráfego; a decisão deve priorizar o Opportunity Score.",
        ],
      },
      config,
    );
  }

  private percent(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  private currency(value: number, currency: string): string {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  }
}
