"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCharacters } from "@/hooks/useCharacters";
import { usePeriods } from "@/hooks/useCrisisPeriods";
import { useNotes } from "@/hooks/useCrisisNotes";
import { useViewingAs } from "@/hooks/useViewingAs";
import type { NoteFilters } from "@/types/api";
import { NoteTable } from "./NoteTable";
import { PlotTimeline } from "./PlotTimeline";
import { StaffNotesPanel } from "./StaffNotesPanel";

export function ArchiveTab() {
  const { data: periods, isLoading: loadingPeriods } = usePeriods();
  const { data: characters } = useCharacters();
  const [staffId] = useViewingAs();

  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const archivedPeriods = periods?.filter((p) => !p.is_active) ?? [];
  const periodId = selectedPeriodId ? Number(selectedPeriodId) : undefined;

  const filters: NoteFilters = {
    ...(periodId != null ? { period_id: periodId } : { archived_only: true }),
    ...(selectedCharacterId ? { character_id: Number(selectedCharacterId) } : {}),
    ...(debouncedQ ? { q: debouncedQ } : {}),
    ...(staffId != null ? { staff_id: staffId } : {}),
  };

  const { data: notes, isLoading: loadingNotes } = useNotes(filters);

  const hasFilters = !!selectedPeriodId || !!selectedCharacterId || !!searchInput;
  function clearFilters() {
    setSelectedPeriodId("");
    setSelectedCharacterId("");
    setSearchInput("");
    setDebouncedQ("");
  }

  return (
    <div className="space-y-4">
      <PlotTimeline periods={periods ?? []} />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search notes…"
          className="h-8 w-44"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />

        <Select
          value={selectedCharacterId || "__all__"}
          onValueChange={(v) => setSelectedCharacterId(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="h-8 w-44">
            <SelectValue placeholder="All characters" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All characters</SelectItem>
            {characters?.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {loadingPeriods ? (
          <Skeleton className="h-8 w-44" />
        ) : (
          <Select
            value={selectedPeriodId || "__all__"}
            onValueChange={(v) => setSelectedPeriodId(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="h-8 w-44">
              <SelectValue placeholder="All periods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All periods</SelectItem>
              {archivedPeriods.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={clearFilters}>
            <X className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {loadingNotes ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <NoteTable notes={notes ?? []} readOnly />
      )}

      {periodId && <StaffNotesPanel periodId={periodId} readOnly />}
    </div>
  );
}
