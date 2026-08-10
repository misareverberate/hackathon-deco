import { Opportunity, Priority } from "./types.js";

export interface ScoredOpportunity {
  opportunity: Opportunity;
  score: number;
  priority: Priority;
}

export function derivePriority(score: number): Priority {
  if (score >= 75) {
    return "critica";
  }
  if (score >= 60) {
    return "alta";
  }
  if (score >= 40) {
    return "media";
  }
  return "baixa";
}

export function toScoredOpportunities(
  opportunities: Opportunity[],
): ScoredOpportunity[] {
  return opportunities.map((opportunity) => ({
    opportunity,
    score: 0,
    priority: "baixa",
  }));
}
