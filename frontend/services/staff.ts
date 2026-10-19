import { apiClient } from "@/lib/apiClient";
import type { StaffCreate, StaffResponse } from "@/types/api";

export const staffService = {
  list: () => apiClient.get<StaffResponse[]>("/api/staff"),

  create: (body: StaffCreate) => apiClient.post<StaffResponse>("/api/staff", body),

  delete: (id: number) => apiClient.delete<void>(`/api/staff/${id}`),
};
