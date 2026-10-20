"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { crisisNotesService } from "@/services/crisisNotes";
import type { CrisisNoteCreate, CrisisNoteUpdate, NoteFilters } from "@/types/api";

export function useNotes(filters: NoteFilters, enabled = true) {
  return useQuery({
    queryKey: ["notes", filters],
    queryFn: () => crisisNotesService.list(filters),
    enabled,
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CrisisNoteCreate) => crisisNotesService.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      toast.success("Note added.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add note."),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: CrisisNoteUpdate }) =>
      crisisNotesService.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      toast.success("Note updated.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update note."),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => crisisNotesService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      toast.success("Note deleted.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete note."),
  });
}

// periodId=null means "all periods"; staffId narrows to one CA's characters.
export function useAnalytics(periodId: number | null | undefined, staffId: number | null = null) {
  return useQuery({
    queryKey: ["analytics", periodId ?? "all", staffId],
    queryFn: () => crisisNotesService.getAnalytics(periodId ?? null, staffId),
    enabled: periodId !== undefined,
  });
}
