"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApplicationOverviewTab } from "./ApplicationOverviewTab";
import { ApplicationPodsTab } from "./ApplicationPodsTab";
import { LogsViewer } from "./LogsViewer";
import { ApplicationConfigMapsTab } from "./ApplicationConfigMapsTab";
import { ApplicationSecretsTab } from "./ApplicationSecretsTab";
import { ApplicationDatabasesTab } from "./ApplicationDatabasesTab";
import { MetricsCard } from "./MetricsCard";
import { ApplicationNetworkTab } from "./ApplicationNetworkTab";
import {
  LayoutList,
  Container,
  ScrollText,
  FileText,
  KeyRound,
  Database,
  Activity,
  Globe,
} from "lucide-react";
import type { ApplicationDetail as ApplicationDetailType } from "@/lib/types";

const TABS = [
  { id: "overview", label: "Overview", icon: <LayoutList className="h-4 w-4" /> },
  { id: "pods", label: "Pods", icon: <Container className="h-4 w-4" /> },
  { id: "logs", label: "Logs", icon: <ScrollText className="h-4 w-4" /> },
  { id: "configmaps", label: "ConfigMaps", icon: <FileText className="h-4 w-4" /> },
  { id: "secrets", label: "Secrets", icon: <KeyRound className="h-4 w-4" /> },
  { id: "databases", label: "Databases", icon: <Database className="h-4 w-4" /> },
  { id: "metrics", label: "Metrics", icon: <Activity className="h-4 w-4" /> },
  { id: "network", label: "Network", icon: <Globe className="h-4 w-4" /> },
];

interface ApplicationDetailProps {
  namespace: string;
  app: string;
}

export function ApplicationDetail({ namespace, app }: ApplicationDetailProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const { data, error, loading } = useApi<ApplicationDetailType>(
    `/applications/${namespace}/${app}`,
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72 rounded-[var(--radius-md)]" />
        <Skeleton className="h-10 w-full rounded-[var(--radius-md)]" />
        <Skeleton className="h-64 w-full rounded-[var(--radius-xl)]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-red-500/20 bg-[var(--error-subtle)] p-4 text-sm text-red-400">
        {error || "Aplicação não encontrada"}
      </div>
    );
  }

  const healthy = data.deployment.availableReplicas >= data.deployment.replicas;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">{data.name}</h2>
        <Badge variant="default">{data.namespace}</Badge>
        <Badge variant={healthy ? "healthy" : "degraded"} dot>
          {data.deployment.availableReplicas}/{data.deployment.replicas} replicas
        </Badge>
      </div>

      <Tabs tabs={TABS} activeId={activeTab} onChange={setActiveTab} />

      <div className="mt-4">
        {activeTab === "overview" && <ApplicationOverviewTab detail={data} onTabChange={setActiveTab} />}
        {activeTab === "pods" && <ApplicationPodsTab namespace={namespace} app={app} />}
        {activeTab === "logs" && <LogsViewer namespace={namespace} app={app} />}
        {activeTab === "configmaps" && <ApplicationConfigMapsTab namespace={namespace} app={app} />}
        {activeTab === "secrets" && <ApplicationSecretsTab namespace={namespace} app={app} />}
        {activeTab === "databases" && <ApplicationDatabasesTab namespace={namespace} app={app} />}
        {activeTab === "metrics" && <MetricsCard namespace={namespace} app={app} />}
        {activeTab === "network" && <ApplicationNetworkTab namespace={namespace} app={app} />}
      </div>
    </div>
  );
}
