"use client";

import { useState } from "react";
import { FilterIcon, Trash2, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useCreateStaff, useDeleteStaff, useStaff } from "@/hooks/useStaff";
import { useViewingAs } from "@/hooks/useViewingAs";
import { cn } from "@/lib/utils";

const ALL = "__all__";

/** Filter button that narrows notes and character lists to one CA's characters. */
export function ViewingAsFilter({ variant = "outline", className }: { variant?: "outline" | "ghost"; className?: string }) {
  const { data: staff = [] } = useStaff();
  const [staffId, setStaffId] = useViewingAs();
  const [manageOpen, setManageOpen] = useState(false);
  // A CA deleted elsewhere falls back to everyone.
  const active = staff.find((s) => s.id === staffId);

  return (
    <>
      <div className={cn("flex items-center", className)}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={active ? "secondary" : variant}
              size="sm"
              className={cn(active ? "max-w-44 rounded-r-none" : "text-muted-foreground")}
              aria-label={active ? `Filtered to ${active.name}'s characters` : "Filter by CA"}
            >
              <FilterIcon className={cn("h-4 w-4", active && "fill-current")} />
              <span className="truncate">{active ? active.name : "Filter"}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              Show characters assigned to
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={active ? String(active.id) : ALL}
              onValueChange={(v) => setStaffId(v === ALL ? null : Number(v))}
            >
              <DropdownMenuRadioItem value={ALL}>All CAs</DropdownMenuRadioItem>
              {staff.map((s) => (
                <DropdownMenuRadioItem key={s.id} value={String(s.id)}>
                  {s.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setManageOpen(true)}>Manage CAs…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {active && (
          <Button
            variant="secondary"
            size="sm"
            className="rounded-l-none border-l border-background/60 px-2"
            onClick={() => setStaffId(null)}
            aria-label="Clear filter"
          >
            <XIcon className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
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
