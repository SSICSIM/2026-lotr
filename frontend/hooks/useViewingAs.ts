"use client";

import { useCallback, useSyncExternalStore } from "react";

// Which CA's characters the site is narrowed to, remembered per browser.
// Null shows everyone.
const KEY = "lotr:viewing-as";
const EVENT = "lotr:viewing-as";

function read(): number | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? Number(raw) || null : null;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function useViewingAs(): [number | null, (staffId: number | null) => void] {
  const staffId = useSyncExternalStore(subscribe, read, () => null);
  const set = useCallback((id: number | null) => {
    try {
      if (id == null) window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, String(id));
    } catch {
      // Storage blocked: the choice just won't stick.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [staffId, set];
}

/** Whether a character is shown under the current "Viewing as" choice. */
export function isAssigned(character: { assigned_staff_ids: number[] }, staffId: number | null) {
  return staffId == null || character.assigned_staff_ids.includes(staffId);
}
