import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CountUp } from "./count-up";

interface MetricCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: "primary" | "success" | "warning" | "destructive" | "info";
  description?: string;
  className?: string;
}

const toneClasses: Record<MetricCardProps["tone"], string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  destructive: "bg-red-500/10 text-destructive",
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

export function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
  description,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("transition-all hover:shadow-md", className)}>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-lg",
            toneClasses[tone],
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <div className="flex items-baseline gap-1">
            <CountUp
              value={value}
              className="text-2xl font-bold tabular-nums tracking-tight"
              ariaLabel={`${label}: ${value}`}
            />
            {description ? (
              <span className="truncate text-xs text-muted-foreground">
                {description}
              </span>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
