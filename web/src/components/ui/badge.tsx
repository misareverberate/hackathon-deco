import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-primary/25 bg-primary/10 text-primary",
        secondary: "border-border bg-secondary text-secondary-foreground",
        destructive:
          "border-destructive/25 bg-destructive/10 text-destructive",
        outline: "text-foreground",
        success: "border-emerald-600/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300",
        warning:
          "border-amber-600/20 bg-amber-500/8 text-amber-700 dark:text-amber-300",
        info: "border-sky-600/20 bg-sky-500/8 text-sky-700 dark:text-sky-300",
        neutral: "border-border bg-muted/60 text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge };
