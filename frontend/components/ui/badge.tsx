import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow-sm hover:shadow-md",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/90",
        outline: "text-foreground border-border/60 hover:bg-muted/40",
        riskHigh: "border-red-500/30 bg-gradient-to-r from-red-950/40 to-red-900/30 text-red-200 shadow-md shadow-red-500/10",
        riskMedium: "border-amber-500/30 bg-gradient-to-r from-amber-950/40 to-amber-900/30 text-amber-200 shadow-md shadow-amber-500/10",
        riskLow: "border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 to-emerald-900/30 text-emerald-200 shadow-md shadow-emerald-500/10"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

