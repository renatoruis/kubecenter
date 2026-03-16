import { ApplicationDetail } from "@/components/features/ApplicationDetail";

interface PageProps {
  params: Promise<{ namespace: string; app: string }>;
}

export default async function ApplicationDetailPage({ params }: PageProps) {
  const { namespace, app } = await params;

  return (
    <div className="space-y-6 animate-fade-in">
      <ApplicationDetail namespace={namespace} app={app} />
    </div>
  );
}
