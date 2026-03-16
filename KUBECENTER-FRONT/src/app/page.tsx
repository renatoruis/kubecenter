import { ClusterOverview } from "@/components/features/ClusterOverview";

export default function Home() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">Dashboard</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Visão geral do cluster Kubernetes</p>
      </div>
      <ClusterOverview />
    </div>
  );
}
