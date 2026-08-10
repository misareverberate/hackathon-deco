import { lazy, Suspense, useCallback, useState } from "react";
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { Header } from "@/components/layout/header";
import { NewAnalysisDialog } from "@/components/dashboard/new-analysis-dialog";
import { DashboardPage } from "@/pages/dashboard-page";
import { mockReport } from "@/lib/mockReport";
import type { AnalyzeResponse } from "@/lib/api";
import type { RecommendationReport } from "@/lib/report";
import { ApiAccessGate } from "@/components/api-access-gate";

const AnalyzePage = lazy(() => import("@/pages/analyze-page").then((module) => ({ default: module.AnalyzePage })));

export default function App() {
  return (
    <HashRouter>
      <ApiAccessGate>
        <AppShell />
      </ApiAccessGate>
    </HashRouter>
  );
}

function AppShell() {
  const [report, setReport] = useState<RecommendationReport>(mockReport);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const navigate = useNavigate();

  const handleCompleted = useCallback(
    (liveReport: RecommendationReport) => {
      setReport(liveReport);
      setAnalysisOpen(false);
      navigate("/");
    },
    [navigate],
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Header report={report} onNewAnalysis={() => setAnalysisOpen(true)} />

      <div className="flex-1">
        <Routes>
          <Route path="/" element={<DashboardPage report={report} crawl={(report as AnalyzeResponse).crawl} geo={(report as AnalyzeResponse).geo} />} />
          <Route path="/analise" element={<Suspense fallback={null}><AnalyzePage onReport={setReport} /></Suspense>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      <footer className="border-t py-6">
        <p className="mx-auto max-w-[1480px] px-4 text-center text-xs text-muted-foreground sm:px-6 lg:px-8">
          Commerce Intelligence · Agente de crescimento para e-commerce
        </p>
      </footer>

      <NewAnalysisDialog
        open={analysisOpen}
        onOpenChange={setAnalysisOpen}
        defaultUrl={report.site.baseUrl}
        onCompleted={handleCompleted}
      />
    </div>
  );
}
