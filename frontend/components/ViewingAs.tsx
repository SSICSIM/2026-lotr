"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useCreateStaff, useDeleteStaff, useStaff } from "@/hooks/useStaff";
import { useViewingAs } from "@/hooks/useViewingAs";
import { cn } from "@/lib/utils";

const ALL = "__all__";
const MANAGE = "__manage__";

/** "Viewing as: All / <CA>" — narrows notes and character lists to one CA's characters. */
export function ViewingAsSelect({ className }: { className?: string }) {
  const { data: staff = [] } = useStaff();
  const [staffId, setStaffId] = useViewingAs();
  const [manageOpen, setManageOpen] = useState(false);
  // A CA deleted elsewhere falls back to everyone.
  const current = staff.some((s) => s.id === staffId) ? String(staffId) : ALL;

  return (
    <>
      <Select
        value={current}
        onValueChange={(v) => {
          if (v === MANAGE) setManageOpen(true);
          else setStaffId(v === ALL ? null : Number(v));
        }}
      >
        <SelectTrigger size="sm" className={cn("w-44 text-xs", className)} aria-label="Viewing as">
          <span className="text-muted-foreground">Viewing as</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All characters</SelectItem>
          {staff.map((s) => (
            <SelectItem key={s.id} value={String(s.id)}>
              {s.name}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={MANAGE}>Manage CAs…</SelectItem>
        </SelectContent>
      </Select>
      <ManageStaffDialog open={manageOpen} onOpenChange={setManageOpen} />
    </>
  );
}

function ManageStaffDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: staff = [] } = useStaff();
  const { mutate: create, isPending: creating } = useCreateStaff();
  const { mutate: remove } = useDeleteStaff();
  const [name, setName] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Crisis assistants</DialogTitle>
          <DialogDescription>
            Assign CAs to characters from the character manager or a character&apos;s edit dialog.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {!staff.length && <p className="text-muted-foreground text-sm">No CAs yet.</p>}
          {staff.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50">
              <span className="text-sm">{s.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => remove(s.id)}
                aria-label={`Remove ${s.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Separator />
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            create({ name: name.trim() }, { onSuccess: () => setName("") });
          }}
        >
          <Input placeholder="CA name…" value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
          <Button type="submit" disabled={creating || !name.trim()}>
            Add
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
