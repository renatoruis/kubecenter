"use client";

import { Select } from "@/components/ui/Select";
import type { ApplicationListItem } from "@/lib/types";

interface NamespaceAppFiltersProps {
  namespaces: string[];
  applications: ApplicationListItem[];
  namespace: string;
  app: string;
  onNamespaceChange: (value: string) => void;
  onAppChange: (value: string) => void;
}

export function NamespaceAppFilters({
  namespaces,
  applications,
  namespace,
  app,
  onNamespaceChange,
  onAppChange,
}: NamespaceAppFiltersProps) {
  const appsInNamespace = namespace
    ? applications.filter((a) => a.namespace === namespace)
    : applications;
  const appOptions = [...new Set(appsInNamespace.map((a) => a.name))].map((name) => ({
    value: name,
    label: name,
  }));
  const namespaceOptions = namespaces.map((ns) => ({ value: ns, label: ns }));

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select
        label="Namespace"
        options={namespaceOptions}
        value={namespace}
        onChange={(v) => {
          onNamespaceChange(v);
          onAppChange("");
        }}
        placeholder="Todos"
      />
      <Select
        label="Aplicação"
        options={appOptions}
        value={app}
        onChange={onAppChange}
        placeholder="Todas"
      />
    </div>
  );
}
