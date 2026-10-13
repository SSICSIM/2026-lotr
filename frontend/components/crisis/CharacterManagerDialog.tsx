"use client";

import { useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCharacters,
  useCreateCharacter,
  useDeleteCharacter,
  useBulkUploadCharacters,
} from "@/hooks/useCharacters";
import type { CharacterResponse } from "@/types/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CharacterManagerDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CharacterResponse | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: characters, isLoading } = useCharacters();
  const { mutate: create, isPending: creating } = useCreateCharacter();
  const { mutate: remove, isPending: deleting } = useDeleteCharacter();
  const { mutate: bulkUpload, isPending: uploading } = useBulkUploadCharacters();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    create({ name: name.trim() }, { onSuccess: () => setName("") });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    bulkUpload(file, { onSettled: () => { if (fileRef.current) fileRef.current.value = ""; } });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
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
              <span className="text-sm">{c.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => setDeleteTarget(c)}
                aria-label={`Remove ${c.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
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
          Columns: name, class, a, start location, image link
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
