"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActivePeriod, useArchivePeriod } from "@/hooks/useCrisisPeriods";

interface Props {
  periodId: number;
  periodName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArchivePeriodDialog({ periodId, periodName, open, onOpenChange }: Props) {
  const { mutate, isPending } = useArchivePeriod();
  const { data: activePeriod } = useActivePeriod();
  const [description, setDescription] = useState("");

  // Start from whatever was drafted for this period already.
  useEffect(() => {
    if (open) setDescription(activePeriod?.id === periodId ? (activePeriod.description ?? "") : "");
  }, [open, activePeriod, periodId]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive "{periodName}"?</AlertDialogTitle>
          <AlertDialogDescription>
            All current notes will be moved to the archive and any newly discovered regions are
            revealed to delegates. The next round will start automatically so crisis staff can keep
            logging without interruption.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="period-update">Crisis update (what happened this round)</Label>
          <Textarea
            id="period-update"
            placeholder="The Fellowship reached Lothlórien; Saruman's forces marched on the Gap of Rohan…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-28"
          />
          <p className="text-muted-foreground text-xs">
            Shown to staff next round as the previous update, and kept in the plot timeline.
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              // Keep the dialog open until the archive succeeds.
              e.preventDefault();
              mutate(
                { id: periodId, body: { description } },
                { onSuccess: () => onOpenChange(false) }
              );
            }}
          >
            {isPending ? "Archiving…" : "Archive & Start Next Round"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
