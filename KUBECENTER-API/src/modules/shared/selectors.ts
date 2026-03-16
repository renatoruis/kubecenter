import type k8s from "@kubernetes/client-node";

export const buildLabelSelector = (labels: Record<string, string> = {}): string =>
  Object.entries(labels)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key}=${value}`)
    .join(",");

export const labelsMatchSelector = (
  labels: Record<string, string> = {},
  selector: Record<string, string> = {},
): boolean =>
  Object.entries(selector).every(([key, value]) => labels[key] === value);

export const getDeploymentSelector = (
  deployment: k8s.V1Deployment,
): Record<string, string> => deployment.spec?.selector?.matchLabels ?? {};

export type WorkloadRefs = {
  configMaps: Set<string>;
  secrets: Set<string>;
  configMapUsage: Record<string, string[]>;
  secretUsage: Record<string, string[]>;
};

const pushUsage = (
  table: Record<string, string[]>,
  name: string,
  usage: string,
): void => {
  if (!table[name]) {
    table[name] = [];
  }
  if (!table[name].includes(usage)) {
    table[name].push(usage);
  }
};

export const extractWorkloadRefs = (
  templateSpec?: k8s.V1PodSpec,
): WorkloadRefs => {
  const refs: WorkloadRefs = {
    configMaps: new Set<string>(),
    secrets: new Set<string>(),
    configMapUsage: {},
    secretUsage: {},
  };

  const volumes = templateSpec?.volumes ?? [];
  const containers = templateSpec?.containers ?? [];

  for (const volume of volumes) {
    const volumeName = volume.name ?? "volume";
    if (volume.configMap?.name) {
      refs.configMaps.add(volume.configMap.name);
      pushUsage(refs.configMapUsage, volume.configMap.name, `volume:${volumeName}`);
    }
    if (volume.secret?.secretName) {
      refs.secrets.add(volume.secret.secretName);
      pushUsage(refs.secretUsage, volume.secret.secretName, `volume:${volumeName}`);
    }
  }

  for (const container of containers) {
    const containerName = container.name ?? "container";

    for (const envFrom of container.envFrom ?? []) {
      if (envFrom.configMapRef?.name) {
        refs.configMaps.add(envFrom.configMapRef.name);
        pushUsage(refs.configMapUsage, envFrom.configMapRef.name, `envFrom:${containerName}`);
      }
      if (envFrom.secretRef?.name) {
        refs.secrets.add(envFrom.secretRef.name);
        pushUsage(refs.secretUsage, envFrom.secretRef.name, `envFrom:${containerName}`);
      }
    }

    for (const env of container.env ?? []) {
      if (env.valueFrom?.configMapKeyRef?.name) {
        refs.configMaps.add(env.valueFrom.configMapKeyRef.name);
        pushUsage(
          refs.configMapUsage,
          env.valueFrom.configMapKeyRef.name,
          `env:${containerName}:${env.name ?? "VAR"}`,
        );
      }
      if (env.valueFrom?.secretKeyRef?.name) {
        refs.secrets.add(env.valueFrom.secretKeyRef.name);
        pushUsage(
          refs.secretUsage,
          env.valueFrom.secretKeyRef.name,
          `env:${containerName}:${env.name ?? "VAR"}`,
        );
      }
    }
  }

  return refs;
};
