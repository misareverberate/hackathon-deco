import { useCallback, useEffect, useRef, useState } from "react";
import {
  analyzeSiteStreaming,
  type AnalysisEvent,
  type AnalyzeOptions,
  type AnalyzeResponse,
  type AnalysisStage,
  type CrawlProgressEvent,
} from "@/lib/api";

export type AnalysisStatus = "idle" | "running" | "success" | "error";

export interface CompletedStage {
  stage: AnalysisStage;
  label: string;
  startedAt: number;
  endedAt: number;
}

export interface ActiveStage {
  stage: AnalysisStage;
  label: string;
  startedAt: number;
}

interface ProgressState {
  active: ActiveStage | null;
  completed: CompletedStage[];
}

const INITIAL_PROGRESS: ProgressState = { active: null, completed: [] };

export function useAnalysis() {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [report, setReport] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [progress, setProgress] = useState<ProgressState>(INITIAL_PROGRESS);
  const [crawl, setCrawl] = useState<CrawlProgressEvent | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const run = useCallback(async (url: string, options?: AnalyzeOptions) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus("running");
    setError(null);
    setReport(null);
    setStartedAt(Date.now());
    setProgress(INITIAL_PROGRESS);
    setCrawl(null);

    const handleEvent = (event: AnalysisEvent): void => {
      if (event.type === "stage") {
        setProgress((current) => {
          const completed = [...current.completed];
          if (current.active) {
            completed.push({
              stage: current.active.stage,
              label: current.active.label,
              startedAt: current.active.startedAt,
              endedAt: event.at,
            });
          }
          return {
            completed,
            active: {
              stage: event.stage,
              label: event.label,
              startedAt: event.at,
            },
          };
        });
        return;
      }
      if (event.type === "crawl-progress") {
        setCrawl(event);
      }
    };

    try {
      const result = await analyzeSiteStreaming(
        url,
        options ?? {},
        handleEvent,
        controller.signal,
      );
      if (controllerRef.current !== controller) return;
      setReport(result);
      setStatus("success");
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStatus("idle");
    setStartedAt(null);
    setProgress(INITIAL_PROGRESS);
    setCrawl(null);
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStatus("idle");
    setReport(null);
    setError(null);
    setStartedAt(null);
    setProgress(INITIAL_PROGRESS);
    setCrawl(null);
  }, []);

  return {
    status,
    report,
    error,
    run,
    cancel,
    reset,
    startedAt,
    activeStage: progress.active,
    completedStages: progress.completed,
    crawl,
  };
}
