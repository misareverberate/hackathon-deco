import type { ImpactConfig } from "../config/impactConfig.js";

export class BusinessWeightResolver {
  resolve(config: ImpactConfig, opportunityId: string): number {
    return config.weights.business[opportunityId] ?? config.defaultBusinessWeight;
  }
}
