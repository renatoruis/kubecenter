import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ namespace: string }>;
}

export default async function NamespaceRedirectPage({ params }: PageProps) {
  const { namespace } = await params;
  redirect(`/applications?namespace=${encodeURIComponent(namespace)}`);
}
