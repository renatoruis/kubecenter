"use client";

import { useApi } from "./useApi";
import type { ApplicationListItem } from "@/lib/types";

export function useApplications() {
  return useApi<ApplicationListItem[]>("/applications");
}
