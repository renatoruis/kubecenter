import { Suspense } from "react";
import { ApplicationsList } from "@/components/features/ApplicationsList";

export default function ApplicationsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">Aplicações</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Deployments gerenciados no cluster</p>
      </div>
      <Suspense>
        <ApplicationsList />
      </Suspense>
    </div>
  );
}
