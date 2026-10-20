"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteNote, useNotes } from "@/hooks/useCrisisNotes";
import { useViewingAs } from "@/hooks/useViewingAs";
import type { CrisisNoteResponse, NoteFilters, NoteType, Priority } from "@/types/api";
import { AddNoteDialog } from "./AddNoteDialog";
import { EditNoteSheet } from "./EditNoteSheet";
import { NoteFilters as NoteFiltersBar, type FilterState } from "./NoteFilters";
import { NoteTable } from "./NoteTable";
import { StaffNotesPanel } from "./StaffNotesPanel";

interface Props {
  activePeriodId: number | null;
}

export function ActiveNotesTab({ activePeriodId }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [editNote, setEditNote] = useState<CrisisNoteResponse | null>(null);
  const [staffId] = useViewingAs();
  const [rawFilters, setRawFilters] = useState<FilterState>({
    q: "",
    character_id: "",
    priority: "",
    note_type: "",
  });

  const filters: NoteFilters | null = activePeriodId
    ? {
        period_id: activePeriodId,
        q: rawFilters.q || undefined,
        character_id: rawFilters.character_id ? Number(rawFilters.character_id) : undefined,
        priority: (rawFilters.priority as Priority) || undefined,
        note_type: (rawFilters.note_type as NoteType) || undefined,
        staff_id: staffId ?? undefined,
      }
    : null;

  const { data: notes, isLoading } = useNotes(
    filters ?? {},
    !!activePeriodId
  );
  const { mutate: deleteNote } = useDeleteNote();

  if (!activePeriodId) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        Create a period above to start tracking crisis notes.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <NoteFiltersBar filters={rawFilters} onChange={setRawFilters} />
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Note
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <NoteTable
          notes={notes ?? []}
          onEdit={setEditNote}
          onDelete={(id) => deleteNote(id)}
        />
      )}

      <StaffNotesPanel periodId={activePeriodId} />

      <AddNoteDialog open={addOpen} onOpenChange={setAddOpen} activePeriodId={activePeriodId} />
      <EditNoteSheet note={editNote} onOpenChange={(open) => !open && setEditNote(null)} />
    </div>
  );
}
