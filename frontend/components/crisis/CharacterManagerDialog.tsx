"use client";

import { useRef, useState } from "react";
import { Trash2, Upload, UserCog } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCharacters,
  useCreateCharacter,
  useDeleteCharacter,
  useBulkUploadCharacters,
} from "@/hooks/useCharacters";
import { useUpdateCharacter } from "@/hooks/useMap";
import { useStaff } from "@/hooks/useStaff";
import type { CharacterResponse, StaffResponse } from "@/types/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CharacterManagerDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [crisisControlled, setCrisisControlled] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CharacterResponse | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: characters, isLoading } = useCharacters();
  const { mutate: create, isPending: creating } = useCreateCharacter();
  const { mutate: remove, isPending: deleting } = useDeleteCharacter();
  const { mutate: bulkUpload, isPending: uploading } = useBulkUploadCharacters();
  const { data: staff = [] } = useStaff();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    create(
      { name: name.trim(), crisis_controlled: crisisControlled },
      { onSuccess: () => setName("") }
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    bulkUpload(file, { onSettled: () => { if (fileRef.current) fileRef.current.value = ""; } });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Characters</DialogTitle>
        </DialogHeader>

        <div className="max-h-64 space-y-1 overflow-y-auto">
          {isLoading && (
            <>
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </>
          )}
          {!isLoading && (!characters || characters.length === 0) && (
            <p className="text-muted-foreground text-sm">No characters yet.</p>
          )}
          {characters?.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50"
            >
              <span className="flex min-w-0 items-center gap-1.5 text-sm">
                <span className="truncate">{c.name}</span>
                {c.crisis_controlled && <Badge variant="secondary">Crisis</Badge>}
              </span>
              <span className="flex shrink-0 items-center">
                <StaffPicker character={c} staff={staff} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteTarget(c)}
                  aria-label={`Remove ${c.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </span>
            </div>
          ))}
        </div>

        <Separator />

        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            placeholder="Character name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={creating || !name.trim()}>
            Add
          </Button>
        </form>
        <div className="flex items-center gap-2">
          <Checkbox
            id="new-char-crisis"
            checked={crisisControlled}
            onCheckedChange={(v) => setCrisisControlled(v === true)}
          />
          <Label htmlFor="new-char-crisis" className="text-xs font-normal">
            Crisis-controlled (NPC or enemy force, not a delegate)
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv,.json"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mr-2 h-3.5 w-3.5" />
            {uploading ? "Importing…" : "Import sheet (.xlsx, .csv or .json)"}
          </Button>
        </div>
        <p className="text-muted-foreground text-[11px] leading-4">
          Columns: name, class, a, start location, image link, crisis-controlled (yes/no)
        </p>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the character and every crisis note ever written about
              them — including notes in archived periods. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={() => {
                if (deleteTarget) remove(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Which CAs look after a character. */
function StaffPicker({ character, staff }: { character: CharacterResponse; staff: StaffResponse[] }) {
  const { mutate } = useUpdateCharacter();
  const assigned = character.assigned_staff_ids;
  const names = staff.filter((s) => assigned.includes(s.id)).map((s) => s.name);

  function toggle(id: number, on: boolean) {
    const ids = on ? [...assigned, id] : assigned.filter((a) => a !== id);
    mutate({ id: character.id, body: { assigned_staff_ids: ids } });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 max-w-36 px-2 text-xs text-muted-foreground"
          aria-label={`Assign CAs to ${character.name}`}
        >
          <UserCog className="mr-1 h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{names.length ? names.join(", ") : "CAs"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 space-y-1.5">
        {!staff.length && (
          <p className="text-muted-foreground text-xs">Add CAs from &ldquo;Viewing as&rdquo; first.</p>
        )}
        {staff.map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-sm">
            <Checkbox checked={assigned.includes(s.id)} onCheckedChange={(v) => toggle(s.id, v === true)} />
            {s.name}
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}
