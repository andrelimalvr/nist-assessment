import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {}

function Badge({ className, ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
