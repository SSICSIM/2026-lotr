"use client";

import { useState } from "react";
import { Archive, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivePeriod } from "@/hooks/useCrisisPeriods";
import { ArchivePeriodDialog } from "./ArchivePeriodDialog";
import { CreatePeriodDialog } from "./CreatePeriodDialog";
import { PreviousUpdate } from "./PreviousUpdate";

export function PeriodBanner() {
  const { data: activePeriod, isLoading } = useActivePeriod();
  const [createOpen, setCreateOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  if (isLoading) {
    return <Skeleton className="h-12 w-full rounded-lg" />;
  }

  if (!activePeriod) {
    return (
      <>
        <div className="flex items-center justify-between rounded-lg border border-dashed px-4 py-3">
          <p className="text-muted-foreground text-sm">No active crisis period.</p>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <CalendarPlus className="mr-2 h-4 w-4" />
            New Period
          </Button>
        </div>
        <PreviousUpdate className="mt-2" />
        <CreatePeriodDialog open={createOpen} onOpenChange={setCreateOpen} />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Active Period
          </p>
          <p className="font-semibold">{activePeriod.name}</p>
          {activePeriod.description && (
            <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap text-sm">
              {activePeriod.description}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setArchiveOpen(true)}>
          <Archive className="mr-2 h-4 w-4" />
          Archive Period
        </Button>
      </div>
      <PreviousUpdate className="mt-2" />
      <ArchivePeriodDialog
        periodId={activePeriod.id}
        periodName={activePeriod.name}
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
      />
    </>
  );
}
