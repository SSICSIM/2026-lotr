"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useUpdatePeriod } from "@/hooks/useCrisisPeriods";
import type { CrisisPeriodResponse } from "@/types/api";

/** Every crisis update in order: the story of the committee so far. */
export function PlotTimeline({ periods }: { periods: CrisisPeriodResponse[] }) {
  // Oldest first, so it reads as a story.
  const ordered = [...periods].reverse();
  if (!ordered.length) return null;

  return (
    <section className="rounded-lg border px-4 py-3">
      <h3 className="text-sm font-semibold">Plot so far</h3>
      <ol className="mt-3 space-y-4 border-l pl-4">
        {ordered.map((p) => (
          <PlotEntry key={p.id} period={p} />
        ))}
      </ol>
    </section>
  );
}

function PlotEntry({ period }: { period: CrisisPeriodResponse }) {
  const { mutate, isPending } = useUpdatePeriod();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  return (
    <li className="relative">
      <span className="bg-primary absolute top-1.5 -left-[21px] h-2 w-2 rounded-full" />
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {period.name}
          <span className="text-muted-foreground ml-2 text-xs font-normal">
            {format(new Date(period.archived_at ?? period.created_at), "MMM d, HH:mm")}
            {period.is_active && " · in progress"}
          </span>
        </p>
        {!editing && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            aria-label={`Edit the ${period.name} update`}
            onClick={() => {
              setDraft(period.description ?? "");
              setEditing(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {editing ? (
        <div className="mt-1 space-y-2">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus className="min-h-24" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isPending}
              onClick={() =>
                mutate(
                  { id: period.id, body: { description: draft.trim() || null } },
                  { onSuccess: () => setEditing(false) }
                )
              }
            >
              Save
            </Button>
          </div>
        </div>
      ) : period.description ? (
        <p className="mt-1 whitespace-pre-wrap text-sm">{period.description}</p>
      ) : (
        <p className="text-muted-foreground mt-1 text-sm italic">No update written.</p>
      )}
    </li>
  );
}
