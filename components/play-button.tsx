"use client";
import { Loader2, Pause, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function PlayButton({ state, onClick, label, className }: { state: "idle" | "loading" | "playing"; onClick: () => void; label: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={state === "playing" ? `Stop ${label}` : `Play ${label}`}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        state === "playing" && "border-primary text-primary",
        className,
      )}
    >
      {state === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : state === "playing" ? <Pause className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
    </button>
  );
}
