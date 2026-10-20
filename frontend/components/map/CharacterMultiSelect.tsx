"use client";

import { XIcon } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GroupResponse } from "@/types/api";

const GROUP_PREFIX = "group:";

/** Anything pickable: characters, or other named things such as CAs. */
interface Option {
  id: number;
  name: string;
  crisis_controlled?: boolean;
}

/**
 * The design's multi-pick: a plain select that adds to a list of removable
 * chips shown underneath it ("x Nuth  x Buth"). With `groups`, picking a
 * group adds all of its members at once. Crisis-controlled characters are
 * listed apart from delegates.
 */
export function CharacterMultiSelect({
  characters,
  value,
  onChange,
  groups,
  placeholder = "Select option",
  id,
}: {
  characters: Option[];
  value: number[];
  onChange: (ids: number[]) => void;
  groups?: GroupResponse[];
  placeholder?: string;
  id?: string;
}) {
  const remaining = characters.filter((c) => !value.includes(c.id));
  const delegates = remaining.filter((c) => !c.crisis_controlled);
  const crisis = remaining.filter((c) => c.crisis_controlled);
  const byId = new Map(characters.map((c) => [c.id, c]));
  // Groups with someone not already picked.
  const pickableGroups = (groups ?? []).filter((g) => g.member_ids.some((m) => byId.has(m) && !value.includes(m)));

  function pick(v: string) {
    if (v.startsWith(GROUP_PREFIX)) {
      const group = pickableGroups.find((g) => String(g.id) === v.slice(GROUP_PREFIX.length));
      const added = (group?.member_ids ?? []).filter((m) => byId.has(m) && !value.includes(m));
      onChange([...value, ...added]);
    } else {
      onChange([...value, Number(v)]);
    }
  }

  return (
    <div className="space-y-1">
      <Select value="" onValueChange={pick}>
        <SelectTrigger id={id} className="data-[size=default]:h-10 w-full text-xs" disabled={!remaining.length}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {pickableGroups.length || crisis.length ? (
            <>
              {pickableGroups.length ? (
                <>
                  <SelectGroup>
                    <SelectLabel>Groups</SelectLabel>
                    {pickableGroups.map((g) => (
                      <SelectItem key={`g${g.id}`} value={`${GROUP_PREFIX}${g.id}`}>
                        <span className="size-2 rounded-full" style={{ backgroundColor: g.color }} />
                        {g.name} (everyone)
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectSeparator />
                </>
              ) : null}
              {delegates.length ? (
                <SelectGroup>
                  <SelectLabel>{crisis.length ? "Delegates" : "Characters"}</SelectLabel>
                  {delegates.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
              {crisis.length ? (
                <>
                  {delegates.length ? <SelectSeparator /> : null}
                  <SelectGroup>
                    <SelectLabel>Crisis-controlled</SelectLabel>
                    {crisis.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </>
              ) : null}
            </>
          ) : (
            remaining.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {value.length ? (
        <div className="flex flex-wrap gap-1">
          {value.map((cid) => (
            <button
              key={cid}
              type="button"
              onClick={() => onChange(value.filter((v) => v !== cid))}
              className="bg-muted-foreground inline-flex items-center gap-0.5 rounded-sm px-1 text-[10px] leading-4 text-white hover:opacity-80"
              aria-label={`Remove ${byId.get(cid)?.name ?? "character"}`}
            >
              <XIcon className="size-2.5" />
              {byId.get(cid)?.name ?? `#${cid}`}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
