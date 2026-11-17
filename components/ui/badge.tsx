import * as React from "react";
import { cn } from "@/lib/utils";

export const Badge = ({ className, tone = "default", ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "gold" | "good" | "bad" }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
      tone === "default" && "border-border bg-muted text-muted-foreground",
      tone === "gold" && "border-primary/40 bg-primary/10 text-primary",
      tone === "good" && "border-success/40 bg-success/10 text-success",
      tone === "bad" && "border-danger/40 bg-danger/10 text-danger",
      className,
    )}
    {...p}
  />
);
