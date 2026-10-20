"use client";

import { useEffect, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalytics } from "@/hooks/useCrisisNotes";
import { usePeriods } from "@/hooks/useCrisisPeriods";
import { useViewingAs } from "@/hooks/useViewingAs";
import { NotesByCharacterChart } from "./NotesByCharacterChart";
import { PriorityDistributionChart } from "./PriorityDistributionChart";
import { StatCards } from "./StatCards";

// "__all__" sentinel means no period_id filter (aggregate across all periods)
const ALL_PERIODS = "__all__";

interface Props {
  defaultPeriodId?: number | null;
}

export function AnalyticsTab({ defaultPeriodId }: Props) {
  const { data: periods, isLoading: loadingPeriods } = usePeriods();
  const [selected, setSelected] = useState<string>(ALL_PERIODS);

  // defaultPeriodId isn't known on first render (the active-period query is
  // still loading), so auto-select it once it arrives — but only until the
  // user picks something themselves.
  const userPickedRef = useRef(false);
  useEffect(() => {
    if (!userPickedRef.current && defaultPeriodId) {
      setSelected(String(defaultPeriodId));
    }
  }, [defaultPeriodId]);

  function handleSelect(value: string) {
    userPickedRef.current = true;
    setSelected(value);
  }

  // null = all periods, number = specific period, undefined = nothing selected yet
  const periodId: number | null = selected === ALL_PERIODS ? null : Number(selected);

  const [staffId] = useViewingAs();
  const { data: analytics, isLoading: loadingAnalytics } = useAnalytics(periodId, staffId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <p className="text-sm font-medium">Period</p>
        {loadingPeriods ? (
          <Skeleton className="h-8 w-48" />
        ) : (
          <Select value={selected} onValueChange={handleSelect}>
            <SelectTrigger className="h-8 w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PERIODS}>All periods</SelectItem>
              {periods?.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}{" "}
                  {p.is_active && (
                    <span className="text-muted-foreground text-xs">(active)</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loadingAnalytics && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        </div>
      )}

      {analytics && (
        <div className="space-y-4">
          <StatCards summary={analytics} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <NotesByCharacterChart data={analytics.notes_by_character} />
            <PriorityDistributionChart data={analytics.priority_distribution} />
          </div>
        </div>
      )}
    </div>
  );
}
