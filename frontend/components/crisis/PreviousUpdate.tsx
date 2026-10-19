"use client";

import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { usePeriods } from "@/hooks/useCrisisPeriods";
import { cn } from "@/lib/utils";

/** The last published crisis update, so staff know where the plot stands. */
export function PreviousUpdate({ className }: { className?: string }) {
  const { data: periods } = usePeriods();
  // Periods come newest first.
  const previous = periods?.find((p) => !p.is_active && p.description);
  if (!previous) return null;

  return (
    <Collapsible defaultOpen className={cn("rounded-lg border px-4 py-2", className)}>
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 text-left">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Previous update: <span className="normal-case text-foreground">{previous.name}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="mt-2 whitespace-pre-wrap text-sm">{previous.description}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}
