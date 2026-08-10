# Business Impact Engine — Modelo de Estimativa

O Business Impact Engine converte oportunidades técnicas em estimativas de impacto de negócio (tráfego e receita incremental) de forma **transparente e defensável**. Nenhum número sai de um "chute": cada métrica computada carrega uma **explicação estruturada** (`MetricExplanation`) com fórmula, inputs, raciocínio e premissas — e o relatório final expõe a metodologia usada.

## Modelo de explicabilidade (`MetricExplanation`)

Toda métrica computada (score, tráfego, receita, confiança, evidência, agregação, health) embute uma explicação:

```ts
interface MetricExplanation {
  metric: string;                 // nome da métrica ("opportunityScore", "traffic", ...)
  summary: string;                // leitura em linguagem natural
  formula: string;                // equação usada
  inputs: ExplanationInput[];     // { key, label, display, value?, weight?, contribution? }
  rationale: RationalePoint[];    // ✓ suporte, ✗ ausência, ! aviso
  assumptions: string[];          // premissas assumidas
  modelVersion: string;           // versão do modelo (v1.1)
}
```

No frontend, `ExplainableMetric` renderiza cada métrica com um tooltip (resumo) e um bloco expansível "Como chegamos a essa estimativa" (inputs, rationale, premissas, fórmula e versão). `ScoreBreakdown` exibe a decomposição por peso/contribuição como barras.

## Visão geral

```
                   ┌──────────────────────────────────────────────────┐
                   │                 KnowledgeBase                     │
                   │  produtos, páginas, schemas, catalogCount, ...   │
                   └───────────────────────┬──────────────────────────┘
                                           │
                                           ▼
                     ┌───────────────────────────────────────────────┐
                     │               OpportunityScorer                │
                     │  coverage · severity · businessWeight ·        │
                     │  reach · confidence  →  opportunityScore 0–100 │
                     │  (+ explanation, score breakdown por fator)    │
                     └───────────────────────┬───────────────────────┘
                                             ▼
                     ┌───────────────────────────────────────────────┐
                     │  TrafficEstimator → sessões/mês e /ano (range) │
                     │  RevenueEstimator → receita incremental (range)│
                     │  (cada um com explanation + inputs reais)      │
                     └───────────────────────┬───────────────────────┘
                                             ▼
                     ┌───────────────────────────────────────────────┐
                     │  Aggregator → headline (score-driven) +        │
                     │               potentialMaximum + overlap +     │
                     │               evidência + highestOpportunity   │
                     └───────────────────────┬───────────────────────┘
                                             ▼
                     ┌───────────────────────────────────────────────┐
                     │  ExecutiveSummaryBuilder → resumo executivo    │
                     │  (health, highlights, warnings, assumptions)   │
                     └───────────────────────────────────────────────┘
```

Pipeline orquestrado por `BusinessImpactEngine.run()` (`src/recommendation/businessImpactEngine.ts`). O `ImpactCalculator` legado (`src/recommendation/impactCalculator.ts`) continua funcionando como facade por compatibilidade e agora também constrói o `HealthResult`.

## Estrutura de `BusinessImpact`

Por recomendação, o engine produz (`src/recommendation/types.ts`):

```ts
interface BusinessImpact {
  opportunity: OpportunityScoreResult;   // score + fatores + explanation
  businessImpactLevel: "critical" | "high" | "medium" | "low";
  traffic: TrafficEstimate;              // perMonth + perYear + explanation
  revenue: RevenueEstimate;              // low/high + currency + explanation
  confidence: ConfidenceResult;          // label + score + quality + rationale ✓/✗
  evidence: EvidenceResult;              // sources + missingSources + level + description + explanation
  overlap: OverlapResult;                // index + risk
}
```

- `OpportunityScoreResult` traz os cinco fatores (`coverage`, `severity`, `businessWeight`, `reach`, `normalizedReach`), o score e a `explanation` com breakdown por peso e contribuição de cada fator.
- `ConfidenceResult` mantém a fórmula inalterada, mas agora expõe `rationale` com os pontos ✓/✗ (fontes presentes e fontes não conectadas, via `RationalePoint { kind, label, source }`).
- `EvidenceResult.missingSources` lista `SEARCH_CONSOLE` / `GA4` / `MERCHANT_CENTER` ausentes — conectá-los melhora a hierarquia de evidência (lógica em `evidenceSources.ts`, extraída para evitar ciclo de import com o explanation builder).

## Camadas e fórmulas

### 1. Cobertura (`coverage`)

Frações do catálogo afetadas pela oportunidade, conforme o escopo:

| Escopo | Denominador |
|---|---|
| `product` / `category` / `site` | `knowledge.products.length` |
| `page` | `knowledge.pages.length` |

Oportunidades de escopo `site` recebem `affectedProducts = max(1, products.length)` e `affectedProductIds` de todo o catálogo: afetam o site inteiro, não um subconjunto.

```
coverage = clamp01(affectedProducts / denominator)
```

### 2. Severidade e peso de negócio

- **Severidade** vem de `opportunity.impact` (`baixo` 0.3, `medio` 0.6, `alto` 0.8, `muito_alto` 1.0).
- **Peso de negócio** é o peso por tipo de oportunidade (`weights.business`), com fallback `defaultBusinessWeight` (0.3). Exemplos: `op:schema-product` 1.0, `op:schema-incomplete` 0.7, `op:produto-price` 0.5.

### 3. Alcance (`reach`)

```
reach = max(1, affectedProducts ?? ids.length) × média do peso de categoria
```

O peso de categoria valoriza produtos de ticket alto (`weights.category`). Categorias sem peso explícito usam `defaultCategoryWeight` (0.6). O `reach` é normalizado pelo maior reach entre as oportunidades (`normalizedReach`).

### 4. Confiança (`confidence`)

Confiança **não é evidência**: é a qualidade da medição que sustentou a detecção.

```
score = round(clamp(base×0.55 + quality×0.25 + rule×0.20) × 100)
```

- `base` = **maior** peso entre as fontes de evidência presentes (`max`) — SEARCH_CONSOLE/GA4/MERCHANT_CENTER 0.9, CRAWLER 0.65, STRUCTURED_DATA 0.6, STATIC_ASSUMPTION 0.4. A fonte dominante governa: Search Console conectado eleva a confiança mesmo com outras fontes mais fracas.
- `quality` = média de `coverageQuality`, `freshness`, `completeness` (0–1).
- `rule` = `opportunity.confidence` (0–100).
- Rótulos: `HIGH` ≥ 82, `MEDIUM` ≥ 55, senão `LOW`.
- O resultado expõe `components` (base/quality/rule com pesos) e `rationale` (✓ fontes presentes; ✗ "Search Console/GA4 não conectado").

### 5. Opportunity Score

```
raw = coverage×0.20 + severity×0.20 + businessWeight×0.20
      + normalizedReach×0.25 + (confidence/100)×0.15
opportunityScore = clamp(round(raw×100), 0, 100)
```

### 6. Tráfego incremental

```
coverage = min(1, affectedProducts / denominator)
sessões/mês = sessões orgânicas/mês × coverage × ctrLift     // quando informadas pelo cliente
sessões/ano = sessões/mês × monthsPerYear
```

Quando o cliente informa **sessões orgânicas mensais** (`monthlyOrganicSessions`), o volume base é o dado real da operação — a estimativa escala com o tráfego do site.

Sem o dado, o modelo usa o fator de calibração (rotulado como fallback):

```
base = organicOpportunityIndex × denominator          // fator de calibração, não sessões reais
sessões/mês = base × coverage × ctrLift                // ctrLift ∈ [5%, 15%]
sessões/ano = sessões/mês × monthsPerYear
```

O `organicOpportunityIndex` (default 100) é um **fator de calibração, não sessões reais** — rotulado como tal na explicação para evitar má interpretação. A explicação lista os inputs reais (índice ou sessões, denominador, cobertura, CTR lift min/max, meses/ano).

### 7. Receita incremental

```
receita/ano = sessões/ano × organicConversionRate × avgTicket
```

Defaults: conversão 2%, ticket médio R$ 500, moeda BRL. Quando o cliente informa ticket médio e conversão, esses valores substituem os defaults e são listados como inputs da explicação.

### 8. Custo evitado (mão de obra)

```
horas/ano = (1 tarefa se escopo site, senão produtos afetados) × horas por tarefa × frequência/ano
custo evitado/ano = horas/ano × custo da mão de obra/hora
```

Defaults: `hoursPerTask` 0,25 h (15 min), `laborCostPerHour` R$ 60, `taskFrequencyPerYear` 12. Oportunidades de escopo `site` contam como **uma única tarefa** (ex.: corrigir o schema em todo o site é uma ação de 15 min, não por produto). O range usa variação de ±20% no tempo por tarefa. Ações **manuais** geram custo evitado zero. O total agregado entra em `potentialMaximum.costAvoided` (também não aditivo, como receita/tráfego).

### 9. Classificação de impacto e health

- **`classifyImpactLevel(score, config)`** (`config/impactConfig.ts`): `critical` ≥ 75, `high` ≥ 60, `medium` ≥ 40, `low` < 40.
- **Health** (`health.ts`): o `healthScore` 0–100 é contextualizado por nota e rótulo — número é secundário:

| Nota | Faixa | Rótulo |
|---|---|---|
| A | ≥ 90 | Excelente |
| B | ≥ 75 | Bom |
| C | ≥ 60 | Regular |
| D | ≥ 40 | Ruim |
| E | ≥ 20 | Muito Ruim |
| F | < 20 | Crítico |

`0` não é falha de cálculo: vira nota F "Crítico". `health.ts` exporta `healthGrade(score, config)` e `healthResult(score, config)`; `impactCalculator.buildHealth` compõe o `HealthResult` com explicação.

O **`estimatedScoreGain`** do resumo é o ganho potencial máximo de health score: `clamp(100 − healthScore, 0, 100)` — ou seja, o health score subiria até 100 se todas as oportunidades fossem resolvidas. Sem health score disponível, usa a média dos opportunity scores como fallback.

### 10. Agregação (`AggregateImpact`)

```ts
interface AggregateImpact {
  headline: HeadlineEstimate;            // recomendação campeã, com opportunityScore + level
  potentialMaximum: { revenue, traffic }; // Σ ranges — não aditivo
  overlapRisk: OverlapRisk;
  overlapIndex: number;
  evidence: EvidenceResult;
  highestOpportunity: HighestOpportunity; // { recommendationId, title, opportunityScore, businessImpactLevel, confidence }
  explanation: MetricExplanation;        // resumo da agregação
  modelVersion: string;
}
```

- **headline / highestOpportunity** = recomendação de **maior Opportunity Score** (desempate por `revenueGain.low`). A consistência é garantida por decisão de produto: a mesma recomendação é "herói" em todas as seções (score-card, resumo executivo, impacto de negócio). Receita é evidência secundária, não o headline.
- **potentialMaximum** = soma dos ranges de todas as recomendações — **não é aditivo**, pois recomendações podem afetar os mesmos produtos (aviso explícito no rationale da explicação).
- **overlapIndex** = `1 − |∪ ids| / Σ ids` (por item, `computeOverlap(own, others)`); risco: `none` (0), `low` (<0.2), `medium` (≤0.5), `high` (>0.5).
- **evidência** = união das fontes presentes, com nível pela hierarquia de evidência.
- **explanation** substitui a antiga string `methodology` por uma `MetricExplanation` com summary/formula/inputs/rationale.

## Hierarquia de evidência

| Fonte | Descrição | Peso |
|---|---|---|
| `SEARCH_CONSOLE` | Dados reais de busca/impressões | 0.9 |
| `GA4` | Dados reais de tráfego | 0.9 |
| `MERCHANT_CENTER` | Dados de feed de produtos | 0.9 |
| `CRAWLER` | Observações do crawler | 0.65 |
| `STRUCTURED_DATA` | Dados estruturados presentes no site | 0.6 |
| `STATIC_ASSUMPTION` | Suposições do setor | 0.4 |

## Configuração

Tudo é configurável via `ImpactConfig` (`src/recommendation/config/impactConfig.ts`), com merges parciais profundos (`resolveConfig`) e leitura de variáveis de ambiente (`loadConfigFromEnv`).

| Variável | Default |
|---|---|
| `CTR_LIFT_MIN` / `CTR_LIFT_MAX` | 0.05 / 0.15 |
| `ORGANIC_CONVERSION_RATE` | 0.02 |
| `AVG_TICKET` | 500 |
| `CURRENCY` | BRL |
| `ORGANIC_OPPORTUNITY_INDEX` | 100 |
| `MONTHLY_ORGANIC_SESSIONS` | — (sessões reais do cliente, ancoram o tráfego) |
| `HOURS_PER_TASK` | 0.25 |
| `LABOR_COST_PER_HOUR` | 60 |
| `TASK_FREQUENCY_PER_YEAR` | 12 |
| `MONTHS_PER_YEAR` | 12 |
| `IMPACT_WEIGHTS_JSON` | pesos de negócio por id |
| `CATEGORY_WEIGHTS_JSON` | pesos por categoria |
| `SEVERITY_WEIGHTS_JSON` | pesos por nível de severidade |
| `SCORE_WEIGHTS_JSON` | pesos dos 5 fatores do score |
| `CONFIDENCE_THRESHOLDS_JSON` | `{high: 82, medium: 55}` |
| `SOURCE_WEIGHTS_JSON` | pesos por fonte de evidência |
| `IMPACT_LEVEL_THRESHOLDS_JSON` | `{critical: 75, high: 60, medium: 40}` |
| `HEALTH_GRADE_THRESHOLDS_JSON` | faixas A–F da tabela de health |
| `DEFAULT_CATEGORY_WEIGHT` | 0.6 |
| `DEFAULT_BUSINESS_WEIGHT` | 0.3 |

Exemplo de JSON (pesos):
```json
{"IMPACT_WEIGHTS_JSON": "{\"op:schema-product\": 1, \"op:produto-price\": 0.5}"}
```

## Exemplo numérico

Catálogo de 100 produtos, `op:schema-product` afetando 50, `affectedProducts = 50`:

**Sem dados do cliente (fallback por calibração):**
1. **coverage** = 50/100 = 0.5
2. **reach** = 50 × peso de categoria (Notebook = 1.0) = 50
3. **confiança**: fontes `[CRAWLER, STATIC_ASSUMPTION]` → base = max(0.65, 0.4) = 0.65; quality 1, rule 100 → score = 81 → MEDIUM (limiar HIGH = 82).
4. **tráfego** = 100 × 100 × 0.5 = 5.000 sessões/mês × lift [5%,15%] = 250–750/mês → **3.000–9.000/ano**.
5. **receita** = 3.000–9.000 × 2% × R$500 = **R$ 30.000–90.000/ano**.

**Com 10.000 sessões orgânicas/mês informadas:**
4'. **tráfego** = 10.000 × 0.5 × [5%,15%] = 250–750/mês → **3.000–9.000/ano** (mesma ordem de grandeza aqui porque o catálogo de exemplo é pequeno; com operação real de alto volume o número escala de verdade).
5'. **receita** = mesma fórmula, com ticket e conversão informados pelo cliente.

**Custo evitado (ação automatizável, 50 produtos):**
6. horas/ano = 50 × 0,25h × 12 = 150h; **custo evitado = 150h × R$60 = R$ 9.000/ano** (range ±20%: R$ 7.200–10.800).

## Limitações

- Modelo simplificado de apoio à decisão: não é projeção financeira.
- CTR lift e conversão usam benchmarks do setor até a integração de Search Console/GA4.
- Sem `monthlyOrganicSessions` informado, `organicOpportunityIndex` é fator de calibração e a magnitude não reflete o volume real da operação; informe as sessões orgânicas mensais para ancorar a estimativa.
- Horas por tarefa e custo de mão de obra são premissas configuráveis (e informáveis pelo cliente no custo/hora).
- potentialMaximum não é aditivo (sobreposição entre recomendações é explicitada no relatório).
- Health usa faixas A–F: a nota é o principal indicador; o número 0–100 é secundário e 0 → F "Crítico" (não é erro).
