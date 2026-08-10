# AI Commerce Readiness Agent

[![Tests](https://img.shields.io/badge/tests-209%20passing-brightgreen)](https://github.com/ai-commerce-readiness-agent)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-22+-green)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)

Agente de prontidão para e-commerce que analisa uma loja online e gera um relatório completo: health score, oportunidades priorizadas, impacto de negócio estimado e um plano de ação antes/depois — tudo com explicabilidade total.

## Problema

Lojas de e-commerce perdem tráfego e vendas porque mecanismos de busca e agentes de IA não conseguem encontrar, entender ou recomendar seus produtos. O problema tem três camadas:

1. **SEO técnico**: schema incompleto, titles vazios, metatags ausentes
2. **GEO (Generative Engine Optimization)**: agentes de IA respondem "não tenho informações suficientes" quando perguntados sobre produtos da loja
3. **Dados estruturados**: atributos técnicos faltando fazem perguntas de compra específicas ficarem sem resposta

A maioria dos tools de SEO existentes foca apenas na camada 1. Nenhum resolve as três camadas simultaneamente — e nenhuma explica **quanto dinheiro** cada correção vale.

## Como funciona o pipeline

## Como funciona o pipeline

```
URL da loja
    ↓
Crawler (robots.txt + sitemap.xml + HTML)
    ↓
Knowledge Builder (produtos + categorias + schemas)
    ↓
Opportunity Analyzer (Schema, Produto, GEO, Conteúdo, SEO)
    ↓
Opportunity Scorer (5 fatores → Opportunity Score 0–100)
    ↓
Business Impact Engine (tráfego + receita + confiança)
    ↓
Report Generator (JSON + dashboard React)
```

## O que entrega

| Módulo | O que faz |
|---|---|
| **Crawler** | Descobre URLs via robots.txt + sitemap, extrai HTML, JSON-LD e metadados |
| **Knowledge Graph** | Estrutura produtos, categorias, páginas e schemas em um grafo navegável |
| **Opportunity Analyzer** | Detecta oportunidades em 5 dimensões: Schema, Produto, GEO, Conteúdo e SEO |
| **Priority Engine** | Calcula Opportunity Score (5 fatores ponderados) com breakdown explicável |
| **Business Impact** | Estima tráfego e receita incremental com faixas de confiança |
| **Executive Summary** | Gera resumo executivo automático com highlights e warnings |
| **Dashboard** | Interface visual com readiness ring, cards de impacto, roadmap e antes/depois |

## Arquitetura

```
Crawler → Knowledge Builder → Opportunity Analyzer → Opportunity Scorer
    → Business Impact Engine → Report Generator → Dashboard (React)
```

- **Backend**: Node.js + TypeScript — pipeline assíncrono com streaming NDJSON de progresso
- **Frontend**: React 19 + Tailwind + Radix UI + Framer Motion
- **Testes**: 161 no servidor + 47 de UI
- **Configuração**: tudo parametrizável via variáveis de ambiente

## Decisões técnicas

- Pipeline explícito para separar aquisição, extração e normalização
- Tipagem forte para evitar inconsistências entre agentes
- Falhas parciais não interrompem o fluxo; erros são registrados e o snapshot segue sendo montado
- Explicabilidade em cada métrica: fórmula, inputs, rationale e premissas
- Streaming de progresso em tempo real (NDJSON) para feedback ao usuário

## Como executar

```bash
# Instalar dependências
npm install

# Compilar
npm run build

# Rodar testes
npm test

# Iniciar servidor
npm start -- https://sua-loja.com.br

# Modo desenvolvimento (servidor + dashboard)
npm run dev
```

## Exemplo de saída

```
Health Score: 72/100 (B - Bom)
Oportunidades: 5 identificadas
  - critica: 1  |  alta: 2  |  media: 1  |  baixa: 1
Ações automáticas: 2  |  Ações manuais: 3
Ganho potencial de health score: +28 pontos se todas as oportunidades forem resolvidas
```

## Demonstração

### Como gravar uma demo de 60 segundos

1. **Inicie o servidor**: `npm run dev`
2. **Abra o dashboard**: `http://localhost:5173`
3. **Clique em "Nova análise"** e insira uma URL de e-commerce real
4. **Acompanhe o progresso**: os 6 estágios aparecem em tempo real com cronômetro
5. **Explore o resultado**: health ring, cards de impacto, roadmap, antes/depois
6. **Grave a tela**: use OBS, Loom ou a gravadora nativa do sistema

### Slides sugeridos (5 minutos)

1. **Problema**: lojas perdem tráfego para IA que não conhece seus produtos
2. **Solução**: agente local que analisa e prioriza ações
3. **Demo ao vivo**: crawl → dashboard → before/after
4. **Métricas**: health score, oportunidades, impacto estimado
5. **Diferencial**: GEO + explicabilidade + pipeline local

## Diferenciais

| Diferencial | Por que importa |
|---|---|
| **GEO integrado** | Avalia se agentes de IA conseguem recomendar seus produtos — não só se o Google indexa |
| **Explicabilidade completa** | Cada métrica tem fórmula, inputs e rationale — sem "chutes" |
| **Before/After específico** | Mostra o código real que precisa ser alterado, não dicas genéricas |
| **Calibração por catálogo** | Estimativas usam dados reais do site (cobertura, preço médio, categorias) |
| **Pipeline local** | Funciona sem internet, sem API keys, sem cloud — roda na máquina do analista |

## Métricas do modelo

- **Opportunity Score**: coverage (20%) + severity (20%) + business weight (20%) + reach (25%) + confidence (15%)
- **Confiança**: base (evidência) × 0.55 + quality (dados) × 0.25 + rule (detecção) × 0.20
- **Tráfego**: índice de oportunidade × cobertura × CTR lift × meses
- **Receita**: sessões × taxa de conversão × ticket médio

## Público-alvo

- E-commerce managers que precisam de um relatório rápido de prontidão
- Agências digitais que gerenciam múltiplas lojas
- Equipes de SEO que querem priorizar ações com base em impacto de negócio

## Configuração via ambiente

| Variável | Default | Descrição |
|---|---|---|
| `CTR_LIFT_MIN` / `CTR_LIFT_MAX` | 0.05 / 0.15 | Range de aumento de CTR esperado |
| `ORGANIC_CONVERSION_RATE` | 0.02 | Taxa de conversão orgânica |
| `AVG_TICKET` | 500 | Ticket médio em BRL |
| `CURRENCY` | BRL | Moeda |
| `ORGANIC_OPPORTUNITY_INDEX` | 100 | Fator de calibração de oportunidade orgânica |
| `MONTHS_PER_YEAR` | 12 | Meses por ano |
| `CONFIDENCE_THRESHOLDS_JSON` | `{high: 75, medium: 55}` | Limiares de confiança |
| `SOURCE_WEIGHTS_JSON` | pesos padrão | Pesos por fonte de evidência |
| `GROQ_API_KEY` | *(vazio)* | Chave da Groq para síntese do chat e jornadas sob demanda; sem ela o agente usa regras locais |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Modelo usado nas chamadas de LLM |
| `GROQ_RATE_LIMIT` | `20` | Teto compartilhado de requisições LLM por minuto (análise + chat); ao atingir, cai para o fallback de regras |
| `ASSISTANT_SYNTHESIS` | `on` | `off` desliga a redação da resposta final por LLM no chat (volta ao template e corta ~1 chamada por mensagem) |
| `ANALYSIS_TIMEOUT_MS` | `240000` | Deadline total da análise; cancela crawl e LLM ao expirar |
| `CHAT_TIMEOUT_MS` | `60000` | Deadline de cada interação e simulação sob demanda do agente |
| `MAX_CONCURRENT_ANALYSES` | `2` | Número máximo de análises pesadas simultâneas |
| `MAX_CONCURRENT_CHATS` | `4` | Número máximo de operações simultâneas do agente |
| `MAX_SESSION_MEMORY_MB` | `256` | Teto agregado aproximado para sessões mantidas em memória |
| `GEO_MAX_QUESTIONS` | `12` | Máximo de jornadas balanceadas na análise inicial |
| `GEO_CONCURRENCY` | `4` | Jornadas GEO executadas simultaneamente |
| `GEO_JOURNEY_TIMEOUT_MS` | `30000` | Timeout de uma jornada individual |
| `GEO_TOTAL_BUDGET_MS` | `75000` | Orçamento total das simulações GEO |
| `GEO_LLM` | `off` | `on` reativa o LLM nas simulações de compradores do relatório; por padrão a análise GEO usa o motor determinístico de regras |
| `ALLOW_PRIVATE_NETWORKS` | `false` | Exceção apenas para desenvolvimento local; é ignorada em produção |
| `API_KEY` | *(obrigatória em produção)* | Credencial global mantida apenas em memória pelo frontend |
| `CORS_ORIGINS` | origens locais em desenvolvimento | Allowlist separada por vírgulas; obrigatória em produção |
| `TRUST_PROXY_HOPS` | `0` | Número exato de proxies confiáveis para resolver o IP no rate limit |

Cada análise também recebe um token de capacidade aleatório. Chat, reset e
revalidação exigem esse token, impedindo acesso cruzado apenas com o
`analysisId`. Redes privadas são bloqueadas por padrão, inclusive em
desenvolvimento; a exceção local nunca é aceita quando `NODE_ENV=production`.

Em produção, configure `NODE_ENV=production`, uma `API_KEY` aleatória com pelo
menos 32 caracteres e `CORS_ORIGINS` com as origens HTTPS exatas. Gere uma chave
com `openssl rand -base64 32`. A aplicação recusa a inicialização quando essa
configuração está ausente ou permissiva.

As simulações de compradores do relatório usam o motor determinístico de regras
por padrão (`GEO_LLM=off`) e fazem perguntas honestas sobre atributos esperados
de cada categoria (ex.: Garantia, Troca, Memória) — a loja só responde quando
declara esses dados estruturados, então o score GEO discrimina lojas com dados
incompletos. Com `GEO_LLM=on`, um contexto limitado do catálogo é enviado à API
externa para as simulações. Sem `GROQ_API_KEY`, o agente usa o fallback
determinístico local.

Com `GROQ_API_KEY`, o agente também redige a resposta final do chat em linguagem
natural (pt-BR) com base no resumo confiável e nas evidências coletadas; sem a
chave, se a síntese falhar, ou com `ASSISTANT_SYNTHESIS=off`, a resposta usa o
template determinístico. Todas as chamadas à API compartilham um limite por
minuto (`GROQ_RATE_LIMIT`): no 429 a Groq é respeitada via `Retry-After`
(circuit breaker global, sem rajadas de retry) e, enquanto o teto estiver
atingido, o agente degrada silenciosamente para o fallback de regras. Os cards
e a evidência continuam sendo rastreados separadamente no painel.

## Documentação complementar

- [Business Impact Model](docs/business-impact-model.md) — detalhamento do modelo de estimativa de impacto
- [API Documentation (Swagger UI)](http://localhost:8787/api/docs) — especificação OpenAPI 3.0 interativa
- [openapi.json](openapi.json) — especificação OpenAPI 3.0 em JSON (também servida em `GET /api/openapi.json`)

### API

A API expõe os seguintes endpoints (também documentados no Swagger UI em `/api/docs`):

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| `GET` | `/api/health` | — | Health check (público) |
| `GET` | `/api/config` | — | Verifica se `x-api-key` é necessária (público) |
| `POST` | `/api/auth/verify` | API key | Valida credencial |
| `POST` | `/api/analyze` | API key | Inicia análise (streaming NDJSON) |
| `POST` | `/api/chat` | API key + Token | Conversa com o Commerce Assistant |
| `POST` | `/api/chat/reset` | API key + Token | Reseta histórico de conversa |
| `POST` | `/api/apply` | API key + Token | Aplica recomendação (artefato + contrafatorial) |
| `POST` | `/api/validate` | API key + Token | Revalida recomendação via re-crawl |

## Licença

MIT
