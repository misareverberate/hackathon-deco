import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Download,
  LoaderCircle,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Wrench,
} from "lucide-react";
import { askAssistant, resetAssistant, type AssistantResponse, type AssistantToolResult } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAgentCommand } from "@/contexts/agent-command-context";

interface AssistantPanelProps {
  analysisId?: string;
}

interface ConversationItem {
  id: string;
  question: string;
  response: AssistantResponse;
}

const DEFAULT_SUGGESTIONS = [
  "Qual recomendação devo executar primeiro?",
  "Simule um comprador técnico para esta loja.",
  "Como está a performance da análise?",
];

const TOOL_LABELS: Record<string, string> = {
  search_products: "Busca no catálogo",
  compare_products: "Comparação de produtos",
  inspect_opportunities: "Investigação de oportunidades",
  analyze_performance: "Análise de performance",
  simulate_buyer: "Simulação de comprador",
  simulate_counterfactual: "Simulação antes/depois",
  plan_actions: "Planejamento operacional",
  generate_artifact: "Geração de artefato",
  manage_decision: "Memória de decisão",
  validate_action: "Validação pós-correção",
  build_brief: "Narrativa executiva",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function decisionLabel(value: unknown): string {
  return value === "PURCHASE" ? "Comprou" : value === "ABANDON" ? "Abandonou" : "Não resolveu";
}

function journeySummary(value: unknown) {
  const journey = asRecord(value);
  const state = asRecord(journey?.finalState);
  if (!state) return null;
  return {
    decision: decisionLabel(state.decision),
    confidence: typeof state.confidence === "number" ? state.confidence : 0,
    blockers: Array.isArray(state.conversionBlockers) ? state.conversionBlockers.map(String) : [],
  };
}

function downloadArtifact(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ToolResultView({ result }: { result: AssistantToolResult }) {
  if ((result.tool === "search_products" || result.tool === "compare_products") && Array.isArray(result.data)) {
    return (
      <div className="mt-3 overflow-hidden border">
        {result.data.map((value, index) => {
          const product = asRecord(value);
          return (
            <div key={String(product?.id ?? index)} className="grid grid-cols-[1fr_auto] gap-3 border-b p-3 text-xs last:border-b-0">
              <div><p className="font-semibold">{String(product?.name ?? "Produto")}</p><p className="mt-0.5 text-muted-foreground">{String(product?.brand ?? "Marca não informada")} · {String(product?.availability ?? "Disponibilidade não informada")}</p></div>
              <p className="font-semibold tabular-nums">{product?.price ? `R$ ${String(product.price)}` : "Sem preço"}</p>
            </div>
          );
        })}
      </div>
    );
  }
  const data = asRecord(result.data);
  if (!data) return null;

  if (result.tool === "simulate_buyer") {
    const journey = journeySummary(data);
    if (!journey) return null;
    return (
      <div className="mt-3 grid grid-cols-2 border text-xs">
        <div className="p-3"><p className="text-muted-foreground">Decisão</p><p className="mt-1 font-semibold">{journey.decision}</p></div>
        <div className="border-l p-3"><p className="text-muted-foreground">Confiança</p><p className="mt-1 font-semibold tabular-nums">{journey.confidence}/100</p></div>
        {journey.blockers.length > 0 ? <p className="col-span-2 border-t p-3 text-amber-700 dark:text-amber-300">Bloqueadores: {journey.blockers.join(", ")}</p> : null}
      </div>
    );
  }

  if (result.tool === "simulate_counterfactual") {
    const before = journeySummary(data.before);
    const after = journeySummary(data.after);
    if (before && !after) return (
      <div className="mt-3 border-l-2 border-amber-500 bg-amber-500/5 p-3 text-xs">
        <p className="font-semibold">Cenário atual: {before.decision} · {before.confidence}/100</p>
        <p className="mt-1 text-muted-foreground">O cenário posterior exige produtos candidatos na análise.</p>
      </div>
    );
    return before && after ? (
      <div className="mt-3 grid grid-cols-2 border text-xs">
        <div className="p-3"><p className="text-muted-foreground">Estado atual</p><p className="mt-1 font-semibold">{before.decision} · {before.confidence}/100</p></div>
        <div className="border-l border-l-primary p-3"><p className="text-muted-foreground">Com a correção</p><p className="mt-1 font-semibold text-primary">{after.decision} · {after.confidence}/100</p></div>
      </div>
    ) : null;
  }

  if (result.tool === "plan_actions" && Array.isArray(data.phases)) {
    return (
      <div className="mt-3 border">
        {data.phases.map((value, index) => {
          const phase = asRecord(value);
          const items = Array.isArray(phase?.items) ? phase.items : [];
          return (
            <div key={index} className="border-b p-3 last:border-b-0">
              <p className="text-xs font-semibold text-primary">{String(phase?.label ?? `Fase ${index + 1}`)}</p>
              {items.map((item, itemIndex) => {
                const row = asRecord(item);
                return <p key={itemIndex} className="mt-1 text-xs">{itemIndex + 1}. {String(row?.title ?? "Ação")}</p>;
              })}
            </div>
          );
        })}
      </div>
    );
  }

  if (result.tool === "generate_artifact") {
    const artifact = asRecord(data.artifact);
    const content = typeof artifact?.content === "string" ? artifact.content : "";
    const filename = typeof artifact?.filename === "string" ? artifact.filename : "artefato.txt";
    if (!content) return null;
    return (
      <div className="mt-3 border-l-2 border-primary bg-muted/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold">{filename}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => downloadArtifact(filename, content)}><Download />Baixar</Button>
        </div>
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground"><code>{content}</code></pre>
      </div>
    );
  }

  if (result.tool === "validate_action" && Array.isArray(data.checks)) {
    return <div className="mt-3 border p-3">{data.checks.map((value, index) => { const check = asRecord(value); return <p key={index} className="flex items-start gap-2 border-b py-2 text-xs last:border-b-0"><CheckCircle2 className="mt-0.5 size-3.5 text-muted-foreground" />{String(check?.label ?? "Verificação")}</p>; })}</div>;
  }

  if (result.tool === "manage_decision") {
    const decision = asRecord(data.decision);
    const recommendation = asRecord(data.recommendation);
    return (
      <div className="mt-3 flex items-center gap-2 border-l-2 border-primary bg-primary/5 p-3 text-xs">
        <CheckCircle2 className="size-4 text-primary" />
        <span><strong>{String(recommendation?.title ?? "Recomendação")}</strong> · {String(decision?.status ?? "atualizada")}</span>
      </div>
    );
  }

  if (result.tool === "build_brief") {
    return <dl className="mt-3 border">{Object.entries(data).map(([key, value]) => <div key={key} className="grid grid-cols-[7rem_1fr] border-b p-3 text-xs last:border-b-0"><dt className="font-medium capitalize text-muted-foreground">{key}</dt><dd>{String(value)}</dd></div>)}</dl>;
  }

  return null;
}

export function AssistantPanel({ analysisId }: AssistantPanelProps) {
  const { command, clear: clearCommand } = useAgentCommand();
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setConversation([]);
    setExpandedEvidence(null);
    setError(null);
    setLoading(false);
  }, [analysisId]);

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [conversation.length, loading]);

  const submit = useCallback(async (value?: string) => {
    const question = (value ?? message).trim();
    if (!analysisId || !question || loading) return;

    setLoading(true);
    setError(null);
    setMessage("");
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const response = await askAssistant(analysisId, question, controller.signal);
      setConversation((current) => [
        ...current,
        { id: crypto.randomUUID(), question, response },
      ]);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, [analysisId, loading, message]);

  useEffect(() => {
    if (!command || !analysisId || loading) return;
    clearCommand(command.id);
    void submit(command.prompt);
  }, [analysisId, clearCommand, command, loading, submit]);

  const clearConversation = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setLoading(false);
    setConversation([]);
    setExpandedEvidence(null);
    setError(null);
    if (analysisId) {
      void resetAssistant(analysisId).catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
    }
  };

  const suggestions = conversation.at(-1)?.response.suggestions ?? DEFAULT_SUGGESTIONS;

  return (
    <section aria-label="Assistente de comércio" className="w-full scroll-mt-24">
      <Card className="flex min-h-[calc(100vh-6rem)] flex-col overflow-hidden border-t-2 border-t-primary">
        <CardHeader className="border-b pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center border-r text-primary">
                <Bot className="size-5" />
              </span>
              <div>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    Pergunte ao agente
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium",
                    analysisId
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                  )}>
                    <span className={cn("size-1.5 rounded-full", analysisId ? "bg-emerald-500" : "bg-amber-500")} />
                    {analysisId ? "contexto ativo" : "modo demonstração"}
                  </span>
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Investigue o catálogo, os problemas e os compradores simulados desta análise.
                </p>
              </div>
            </div>
            {conversation.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={clearConversation}
                aria-label="Limpar conversa"
                title="Limpar conversa"
              >
                <RotateCcw />
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col space-y-4 p-4 sm:p-5">
          {!analysisId ? (
            <div className="flex items-start gap-3 border-l-2 border-amber-500 bg-amber-500/5 p-3 text-sm text-muted-foreground">
              <CircleHelp className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  Execute uma análise ao vivo para conectar o agente ao catálogo e às recomendações desta loja.
            </div>
          ) : null}

          {conversation.length === 0 && analysisId ? (
            <div className="flex items-center gap-2 border-l-2 border-primary bg-muted/35 px-3 py-4 text-sm text-muted-foreground">
              <Sparkles className="size-4 shrink-0 text-primary" />
              Faça uma pergunta. O agente escolherá a ferramenta certa e mostrará a evidência usada.
            </div>
          ) : null}

          <div className="min-h-[230px] flex-1 space-y-4 overflow-y-auto pr-1">
          {conversation.map((item, index) => {
            const isExpanded = expandedEvidence === item.id;
            const toolLabel = TOOL_LABELS[item.response.tool.tool] ?? item.response.tool.tool;
            return (
              <div key={item.id} className="space-y-3">
                <div className="ml-auto max-w-[92%] rounded-md bg-foreground px-4 py-3 text-sm text-background sm:max-w-[78%]">
                  {item.question}
                </div>
                <div className="max-w-[96%] border-l-2 border-primary bg-muted/35 p-4 sm:max-w-[88%]">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
                    <Wrench className="size-3.5" />
                    {toolLabel}
                  </div>
                  <p className="whitespace-pre-line text-sm leading-relaxed">{item.response.answer}</p>
                  <ToolResultView result={item.response.tool} />
                  {item.response.tool.evidence.length > 0 ? (
                    <div className="mt-3 border-t pt-3">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                        onClick={() => setExpandedEvidence(isExpanded ? null : item.id)}
                        aria-expanded={isExpanded}
                      >
                        <span>Ver evidências ({item.response.tool.evidence.length})</span>
                        <ChevronDown className={cn("size-4 transition-transform", isExpanded && "rotate-180")} />
                      </button>
                      {isExpanded ? (
                        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                          {item.response.tool.evidence.map((evidence) => (
                            <li key={evidence} className="border-l-2 border-primary/25 pl-2.5 leading-relaxed">{evidence}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {index === conversation.length - 1 ? <div ref={endRef} /> : null}
              </div>
            );
          })}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <LoaderCircle className="size-4 animate-spin text-primary" />
              Investigando o contexto da loja…
            </div>
          ) : null}
          </div>

          {error ? <p className="border-l-2 border-destructive bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto min-h-8 whitespace-normal py-1.5 text-left"
                disabled={!analysisId || loading}
                onClick={() => void submit(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>

          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <Input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={!analysisId || loading}
              placeholder="Pergunte sobre produtos, oportunidades ou performance"
              aria-label="Pergunta para o agente"
            />
            {loading ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => requestRef.current?.abort()}
                aria-label="Interromper agente"
                title="Interromper agente"
              >
                <Square />
              </Button>
            ) : (
              <Button type="submit" size="icon" disabled={!analysisId || !message.trim()} aria-label="Enviar pergunta" title="Enviar pergunta">
                <Send />
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
