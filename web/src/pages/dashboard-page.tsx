import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { RecommendationDrawer } from "@/components/dashboard/recommendation-drawer";
import { AssistantPanel } from "@/components/dashboard/assistant-panel";
import { AgentContextPanel } from "@/components/dashboard/agent-context-panel";
import type { CrawlStats } from "@/lib/api";
import type { GeoReport } from "@/lib/report";
import type { Recommendation, RecommendationReport } from "@/lib/report";
import { AgentCommandProvider } from "@/contexts/agent-command-context";

const DashboardDetails = lazy(() =>
  import("@/components/dashboard/dashboard-details").then((module) => ({
    default: module.DashboardDetails,
  })),
);

interface DashboardPageProps {
  report: RecommendationReport;
  crawl?: CrawlStats;
  geo?: GeoReport;
}

export function DashboardPage({ report, crawl, geo }: DashboardPageProps) {
  const [selected, setSelected] = useState<Recommendation | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = detailsRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setShowDetails(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShowDetails(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px", threshold: 0.01 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <AgentCommandProvider>
    <main className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-12">
        <section
          aria-label="Workspace do agente"
          className="grid min-h-[calc(100vh-6.5rem)] items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(380px,1fr)]"
        >
          <div className="min-w-0 lg:flex">
            <AssistantPanel analysisId={report.analysisId} />
          </div>
          <div className="min-w-0 lg:flex">
            <AgentContextPanel report={report} crawl={crawl} geo={geo} onSelect={setSelected} />
          </div>
        </section>

        <div ref={detailsRef} className="min-h-px">
          {showDetails ? (
            <Suspense fallback={<div className="h-24 border-t" aria-hidden="true" />}>
              <DashboardDetails report={report} crawl={crawl} geo={geo} onSelect={setSelected} />
            </Suspense>
          ) : null}
        </div>
      </div>

      <RecommendationDrawer
        analysisId={report.analysisId}
        recommendation={selected}
        onClose={() => setSelected(null)}
      />
    </main>
    </AgentCommandProvider>
  );
}
