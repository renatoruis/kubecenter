import type k8s from "@kubernetes/client-node";
import {
  appsApi,
  assertNamespaceAllowed,
  coreApi,
  notFoundError,
  networkingApi,
  WATCH_NAMESPACES,
} from "../../lib/k8s";
import { getIngressRoutesForServices } from "../network/service";
import { labelsMatchSelector, extractWorkloadRefs } from "../shared/selectors";

type ApplicationListItem = {
  name: string;
  namespace: string;
  replicas: number;
  availableReplicas: number;
  image: string | null;
  services: string[];
  status: "healthy" | "degraded" | "scaled-down";
};

const getServicesForDeployment = (
  services: k8s.V1Service[],
  deployment: k8s.V1Deployment,
): string[] => {
  const deploymentLabels = deployment.spec?.template?.metadata?.labels ?? {};

  return services
    .filter((service) =>
      labelsMatchSelector(deploymentLabels, service.spec?.selector ?? {}),
    )
    .map((service) => service.metadata?.name)
    .filter((name): name is string => Boolean(name));
};

export const listApplications = async (): Promise<ApplicationListItem[]> => {
  const rows: ApplicationListItem[] = [];

  for (const namespace of WATCH_NAMESPACES) {
    const [deploymentResult, servicesResult] = await Promise.all([
      appsApi.listNamespacedDeployment({ namespace }),
      coreApi.listNamespacedService({ namespace }),
    ]);

    const services = servicesResult.items ?? [];

    for (const deployment of deploymentResult.items ?? []) {
      const name = deployment.metadata?.name;
      if (!name) continue;

      const replicas = deployment.spec?.replicas ?? 0;
      const availableReplicas = deployment.status?.availableReplicas ?? 0;

      rows.push({
        name,
        namespace,
        replicas,
        availableReplicas,
        image: deployment.spec?.template?.spec?.containers?.[0]?.image ?? null,
        services: getServicesForDeployment(services, deployment),
        status:
          replicas === 0
            ? "scaled-down"
            : availableReplicas >= replicas
              ? "healthy"
              : "degraded",
      });
    }
  }

  return rows;
};

const summarizeContainers = (podSpec?: k8s.V1PodSpec) =>
  (podSpec?.containers ?? []).map((container) => ({
    name: container.name,
    image: container.image,
    ports: (container.ports ?? []).map((port) => ({
      name: port.name,
      containerPort: port.containerPort,
      protocol: port.protocol,
    })),
    env: (container.env ?? []).map((env) => ({
      name: env.name,
      value: env.value,
      valueFrom: {
        configMapKeyRef: env.valueFrom?.configMapKeyRef?.name
          ? {
              name: env.valueFrom.configMapKeyRef.name,
              key: env.valueFrom.configMapKeyRef.key,
            }
          : null,
        secretKeyRef: env.valueFrom?.secretKeyRef?.name
          ? {
              name: env.valueFrom.secretKeyRef.name,
              key: env.valueFrom.secretKeyRef.key,
            }
          : null,
      },
    })),
    envFrom: (container.envFrom ?? []).map((envFrom) => ({
      configMapRef: envFrom.configMapRef?.name ?? null,
      secretRef: envFrom.secretRef?.name ?? null,
    })),
    resources: {
      requests: container.resources?.requests ?? {},
      limits: container.resources?.limits ?? {},
    },
  }));

export const getApplicationDetail = async (
  namespace: string,
  app: string,
) => {
  assertNamespaceAllowed(namespace);

  const deployment = await appsApi
    .readNamespacedDeployment({ name: app, namespace })
    .then((response) => response)
    .catch((error: { statusCode?: number }) => {
      if (error?.statusCode === 404) {
        throw notFoundError("Deployment", { namespace, app });
      }
      throw error;
    });

  const [servicesResult, ingressesResult] = await Promise.all([
    coreApi.listNamespacedService({ namespace }),
    networkingApi.listNamespacedIngress({ namespace }),
  ]);

  const services = getServicesForDeployment(servicesResult.items ?? [], deployment);
  const servicesSet = new Set(services);

  const ingressStandard = (ingressesResult.items ?? [])
    .filter((item) =>
      (item.spec?.rules ?? []).some((rule) =>
        (rule.http?.paths ?? []).some((path) => {
          const backendServiceName = path.backend?.service?.name;
          return backendServiceName ? servicesSet.has(backendServiceName) : false;
        }),
      ),
    )
    .map((item) => {
      const hosts: string[] = [];
      for (const rule of item.spec?.rules ?? []) {
        if (rule.host) {
          hosts.push(rule.host);
        } else {
          const paths = (rule.http?.paths ?? []).map((p) => p.path).filter(Boolean) as string[];
          if (paths.length > 0) hosts.push(`* (${paths.join(", ")})`);
          else hosts.push("*");
        }
      }
      return { name: item.metadata?.name, hosts };
    });

  const ingressTraefik = await getIngressRoutesForServices(namespace, servicesSet);
  const ingress = [...ingressStandard, ...ingressTraefik];

  const refs = extractWorkloadRefs(deployment.spec?.template?.spec);

  return {
    name: deployment.metadata?.name,
    namespace: deployment.metadata?.namespace,
    deployment: {
      replicas: deployment.spec?.replicas ?? 0,
      availableReplicas: deployment.status?.availableReplicas ?? 0,
      strategy: deployment.spec?.strategy?.type ?? "RollingUpdate",
      selector: deployment.spec?.selector?.matchLabels ?? {},
      updatedAt: deployment.metadata?.creationTimestamp,
    },
    containers: summarizeContainers(deployment.spec?.template?.spec),
    services,
    ingress,
    configmaps: Array.from(refs.configMaps),
    secrets: Array.from(refs.secrets),
  };
};
