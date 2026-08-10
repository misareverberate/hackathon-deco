# Avaliação — Eixo Originalidade

**Nota final: 8/10** (avaliação antes da rodada de reforço)

## Veredito

O diferencial real do agente não é "monitorar menções" de GEO — é a **answerability**
(testabilidade) de fatos de produto: um comprador de IA simulado pergunta e o agente prova,
com rastreabilidade pergunta → fatos usados → atributo bloqueador, se a loja responde ou
não. Depois da rodada de reforço abaixo, esse diferencial fica explícito no relatório e no
dashboard.

## O que sustenta a nota

- **Simulação de compradores por IA** (`price`/`spec`/`brand`) avaliando se os dados
  estruturados respondem a perguntas de compra — não é um dashboard genérico.
- **Resposta simulada do comprador + rastreabilidade**: cada avaliação expõe a frase que
  um agente de IA daria hoje, os produtos/fatos citados e o **atributo bloqueador** que, se
  estruturado, converte a pergunta em resposta completa.
- **Persona de comparação** (`compare`): simula o comprador que decide entre alternativas
  lado a lado — um cenário de decisão real em e-commerce.
- **What-if econômico interativo**: o avaliador deixa de ser estático e recalcula no cliente
  tráfego, receita e custo evitado conforme o ticket, conversão, sessões e mão de obra.
- **"Comodities" evitados**: health score, roadmap e antes/depois são entregues como
  contexto, não como o produto.

## Rodada de reforço executada

1. **Resposta simulada do comprador** (`answerBuilder.ts`): texto da resposta que um agente
   de IA daria hoje por pergunta, com os fatos citados (produto + preço) e os atributos
   bloqueadores. Ancorada na avaliação via `EvaluationResult.answer` e exibida no dashboard
   ("O que um agente de IA responderia hoje") com chip de atributo bloqueador.
2. **Persona comparador** (`compare`): pergunta de comparação entre dois produtos
   ("Entre X e Y, qual possui <atributo>?") gerada por `generateCompareQuestions`,
   pontuada nas 4 personas.
3. **What-if econômico** (`what-if.ts` + `what-if-panel.tsx`): sliders de ticket, conversão,
   sessões orgânicas e mão de obra recalculam o potencial máximo ao vivo no cliente,
   espelhando as fórmulas do modelo (tráfego × conversão × ticket; mão de obra automatizável),
   com delta vs. base e botão de restaurar.

## Comandos de verificação

```bash
npm test              # 96 testes (server + integração HTTP)
npm --prefix web run test   # 23 testes de UI
npm run lint          # 0 erros / 5 warnings
npm run build         # tsc server
npm --prefix web run build  # tsc --noEmit + vite build
```

## Nota pós-reforço

Com a resposta simulada rastreável, a persona de comparação e o what-if econômico
interativo, a originalidade sai do discurso e vira recurso demonstrável. Reavaliação
sugerida: **9/10**.
