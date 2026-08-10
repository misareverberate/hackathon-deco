import { Link } from "react-router-dom";
import {
  CalendarDays,
  Moon,
  Plus,
  Radar,
  Store,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import type { RecommendationReport } from "@/lib/report";

interface HeaderProps {
  report: RecommendationReport;
  onNewAnalysis: () => void;
}

function formatDate(iso?: string): string {
  if (!iso) {
    return "";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function Header({ report, onNewAnalysis }: HeaderProps) {
  const { theme, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1480px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5" aria-label="Commerce Intelligence">
          <span className="flex size-9 items-center justify-center rounded-md bg-foreground">
            <Radar className="size-5 text-white" />
          </span>
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="text-sm font-bold">
              Commerce Intelligence
            </span>
            <span className="text-[11px] text-muted-foreground">
              Agente de crescimento
            </span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-1.5 border-l pl-3 lg:flex">
            <Store className="size-3.5 text-muted-foreground" />
            <span className="max-w-[180px] truncate text-xs font-medium">
              {report.site.title ?? report.site.host}
            </span>
          </div>
          <div
            className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"
            title="Data da análise"
          >
            <CalendarDays className="size-3.5" />
            <span>{formatDate(report.analyzedAt)}</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>

          <Button
            onClick={onNewAnalysis}
            size="sm"
            className="px-2.5 sm:px-3"
            aria-label="Nova análise"
          >
            <Plus />
            <span className="hidden sm:inline">Nova análise</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
