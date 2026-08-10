import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CountUp } from "./count-up";

interface ScoreCardProps {
  label: string;
  value: number;
  max?: number;
  icon?: LucideIcon;
  tone?: "primary" | "success" | "warning" | "destructive";
  suffix?: string;
  description?: string;
  className?: string;
}

const toneText: Record<NonNullable<ScoreCardProps["tone"]>, string> = {
  primary: "text-primary",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  destructive: "text-destructive",
};

export function ScoreCard({
  label,
  value,
  max = 100,
  icon: Icon,
  tone = "primary",
  suffix,
  description,
  className,
}: ScoreCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          {Icon ? <Icon className="size-4" /> : null}
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <CountUp
            value={value}
            className={cn(
              "text-4xl font-bold tabular-nums tracking-tight",
              toneText[tone],
            )}
            ariaLabel={`${label}: ${value}`}
          />
          {suffix ? (
            <span className="text-sm font-medium text-muted-foreground">
              {suffix}
            </span>
          ) : null}
          <span className="ml-auto text-xs font-medium text-muted-foreground">
            / {max}
          </span>
        </div>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
