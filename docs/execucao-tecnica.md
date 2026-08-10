# Avaliação — Eixo Execução Técnica

**Nota final: 9.5/10** (antes: 8.5/10)

## Veredito

Este é o eixo mais forte do agente. Ele funciona de ponta a ponta, a arquitetura é
limpa e consistente, e as ferramentas são usadas com propósito (streaming, injeção de
dependência, explicabilidade e fallbacks). Após a rodada de reforço abaixo, as lacunas
de engenharia foram fechadas.

## O que sustenta a nota

- **Funciona de verdade**: 99 testes no servidor (incluindo integração HTTP) + 30 testes
  de UI, `tsc` estrito limpo nos dois projetos, builds de produção limpos (server + Vite),
  e pipeline completo verificado ponta-a-ponta contra um site fixture local.
- **Arquitetura em camadas** com contratos de dados explícitos (`report.ts` espelhado 1:1
  entre server e web) e injeção de dependência nos módulos-chave
  (`CrawlerPipeline`, `BusinessImpactEngine`, `GroqClient`, `createAppServer`).
- **Motor de explicabilidade** (`MetricExplanation`: fórmula, inputs, rationale,
  premissas, versão do modelo) embutido em cada métrica — sofisticação rara.
- **Ferramentas bem usadas**: TS `strict`, `cheerio` + `fast-xml-parser`, `node:test` sem
  dependências, cliente Groq com retry/backoff, timeout via `AbortController`, JSON mode
  resiliente e degradação graciosa, streaming NDJSON no servidor.
- **Zero `as any`/`@ts-ignore`/`TODO`/`FIXME`** em `src/`.

## Rodada de reforço executada (fechou os gaps de 8.5 → 9.5)

1. **Teste de integração HTTP** — `server.ts` refatorado para `createAppServer(deps?)`
   com guard de módulo principal; novo `tests/server.test.ts` (6 testes) cobrindo
   validações 400 (mensagens pt-BR), `/api/health`, rota desconhecida, pipeline completo
   NDJSON contra site fixture local, resiliência a falha de rede e evento de erro com
   dependência injetada. Zero dependências novas.
2. **Testes de UI** — setup de `vitest` + `@testing-library/react` no `web/`; 30 testes
   em 6 arquivos: `BusinessInputFields` (conversão 2.5 → 0.025), `NewAnalysisDialog`
   (mock de `@/lib/api`: sucesso, envio de business/maxProducts, erro), `BusinessImpactCard`
   (custo evitado + badge de ancoragem) e `App` (render do dashboard + navegação).
3. **ESLint** — flat config (`eslint.config.js`) com `typescript-eslint` (server e web) e
   `react-hooks`/`react-refresh` (web); scripts `lint`/`lint:fix`. 0 erros, 5 warnings
   aceitáveis (exports de variantes em UI kit). Removidos imports/objetos mortos
   encontrados pelo lint (`ExecutiveSummaryModel`, `classifyUrl`, `currency`, etc.).
4. **`zod` removido** do `package.json` (nunca importado).
5. **`as any` eliminado** em `tests/recommendation.test.ts` (índices tipados) e
   `tests/geo.test.ts` (fixtures tipados com `GeoQuestion`/`KnowledgeBase`/`EvaluationResult`).

## Comandos de verificação

```bash
npm test              # 99 testes (server + integração HTTP)
npm --prefix web run test   # 30 testes de UI
npm run lint          # 0 erros / 5 warnings
npm run build         # tsc server
npm --prefix web run build  # tsc --noEmit + vite build
```

## Limitações residuais (aceitas)

- 5 warnings de `react-refresh/only-export-components` em exports de variantes do UI kit
  (`badges.tsx`, `badge.tsx`, `button.tsx`) — padrão legítimo de design system.
- O lint usa `typescript-eslint` recomendado (sem type-checking) para manter o custo de
  manutenção baixo; o type-checking rigoroso fica com o `tsc --noEmit` dos dois projetos.
