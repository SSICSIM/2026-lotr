"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { staffService } from "@/services/staff";
import type { StaffCreate } from "@/types/api";

export function useStaff() {
  return useQuery({
    queryKey: ["staff"],
    queryFn: () => staffService.list(),
  });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StaffCreate) => staffService.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success("CA added.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add CA."),
  });
}

export function useDeleteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => staffService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      // Their assignments go with them.
      qc.invalidateQueries({ queryKey: ["characters"] });
      toast.success("CA removed.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to remove CA."),
  });
}
