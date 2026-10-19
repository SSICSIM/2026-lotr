import { apiClient } from "@/lib/apiClient";
import type {
  CrisisPeriodArchive,
  CrisisPeriodCreate,
  CrisisPeriodResponse,
  CrisisPeriodUpdate,
} from "@/types/api";

export const crisisPeriodsService = {
  list: () => apiClient.get<CrisisPeriodResponse[]>("/api/periods"),
  getActive: () => apiClient.get<CrisisPeriodResponse | null>("/api/periods/active"),
  create: (body: CrisisPeriodCreate) =>
    apiClient.post<CrisisPeriodResponse>("/api/periods", body),
  update: (id: number, body: CrisisPeriodUpdate) =>
    apiClient.patch<CrisisPeriodResponse>(`/api/periods/${id}`, body),
  archive: (id: number, body: CrisisPeriodArchive = {}) =>
    apiClient.post<CrisisPeriodResponse>(`/api/periods/${id}/archive`, body),
};
