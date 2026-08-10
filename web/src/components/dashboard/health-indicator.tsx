import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CountUp } from "./count-up";

interface HealthIndicatorProps {
  score: number;
  className?: string;
  compact?: boolean;
}

function healthTone(score: number): {
  label: string;
  bar: string;
  text: string;
  dot: string;
} {
  if (score >= 80) {
    return {
      label: "Saudável",
      bar: "bg-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
      dot: "bg-emerald-500",
    };
  }
  if (score >= 50) {
    return {
      label: "Atenção",
      bar: "bg-amber-500",
      text: "text-amber-600 dark:text-amber-400",
      dot: "bg-amber-500",
    };
  }
  return {
    label: "Crítico",
    bar: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    dot: "bg-red-500",
  };
}

export function HealthIndicator({ score, className, compact }: HealthIndicatorProps) {
  const tone = healthTone(score);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", tone.dot)} />
          <span className={cn("text-sm font-semibold", tone.text)}>
            {tone.label}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <CountUp
            value={score}
            className={cn(
              "font-bold tabular-nums tracking-tight",
              compact ? "text-2xl" : "text-4xl",
            )}
            ariaLabel={`Health Score: ${score}`}
          />
          <span className="text-xs font-medium text-muted-foreground">/ 100</span>
        </div>
      </div>
      <Progress value={score} indicatorClassName={tone.bar} aria-label="Health Score" />
    </div>
  );
}
