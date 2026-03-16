import {
  appsApi,
  assertNamespaceAllowed,
  coreApi,
  customObjectsApi,
  networkingApi,
  notFoundError,
} from "../../lib/k8s";
import { getDeploymentSelector, labelsMatchSelector } from "../shared/selectors";

const INGRESS_ROUTE_GROUPS = [
  { group: "traefik.io", version: "v1alpha1", plural: "ingressroutes" },
  { group: "traefik.containo.us", version: "v1alpha1", plural: "ingressroutes" },
];

function extractHostsFromMatch(match: string): string[] {
  const hosts: string[] = [];
  const hostRegex = /Host\(`([^`]+)`\)/g;
  let m: RegExpExecArray | null;
  while ((m = hostRegex.exec(match)) !== null) {
    hosts.push(m[1]);
  }
  return hosts;
}

type IngressRouteItem = {
  name: string;
  routes: Array<{ match: string; hosts: string[]; serviceNames: string[] }>;
  className: string | null;
};

async function listIngressRoutes(namespace: string): Promise<IngressRouteItem[]> {
  const result: IngressRouteItem[] = [];

  for (const { group, version, plural } of INGRESS_ROUTE_GROUPS) {
    try {
      const res = await customObjectsApi.listNamespacedCustomObject({
        group,
        version,
        namespace,
        plural,
      });
      const body = (res as { body?: { items?: unknown[] }; items?: unknown[] }).body ?? res;
      const items = (body?.items ?? []) as Array<{
        metadata?: { name?: string };
        spec?: {
          routes?: Array<{
            match?: string;
            services?: Array<{ name?: string; namespace?: string }>;
          }>;
          entryPoints?: string[];
        };
      }>;

      for (const item of items) {
        const routes = (item.spec?.routes ?? []).map((r) => {
          const serviceNames = (r.services ?? [])
            .filter((s) => !s.namespace || s.namespace === namespace)
            .map((s) => s.name)
            .filter((n): n is string => Boolean(n));
          return {
            match: r.match ?? "",
            hosts: extractHostsFromMatch(r.match ?? ""),
            serviceNames,
          };
        });
        result.push({
          name: item.metadata?.name ?? "unknown",
          routes,
          className: item.spec?.entryPoints?.[0] ?? null,
        });
      }
    } catch {
      // CRD pode não existir no cluster
    }
  }

  return result;
}

export async function getIngressRoutesForServices(
  namespace: string,
  serviceNames: Set<string>,
): Promise<Array<{ name: string; hosts: string[] }>> {
  const items = await listIngressRoutes(namespace);
  return items
    .filter((ir) =>
      ir.routes.some((r) => r.serviceNames.some((sn) => serviceNames.has(sn))),
    )
    .map((ir) => {
      const hosts = [...new Set(ir.routes.flatMap((r) => r.hosts))];
      if (hosts.length === 0) {
        const paths = ir.routes.map((r) => r.match).filter(Boolean);
        hosts.push(paths.length > 0 ? `* (${paths[0]})` : "*");
      }
      return { name: ir.name, hosts };
    });
}

export const getApplicationNetwork = async (namespace: string, app: string) => {
  assertNamespaceAllowed(namespace);

  const deployment = await appsApi
    .readNamespacedDeployment({ namespace, name: app })
    .catch((error: { statusCode?: number }) => {
      if (error?.statusCode === 404) {
        throw notFoundError("Deployment", { namespace, app });
      }
      throw error;
    });

  const deploymentSelector = getDeploymentSelector(deployment);

  const [servicesResult, ingressResult] = await Promise.all([
    coreApi.listNamespacedService({ namespace }),
    networkingApi.listNamespacedIngress({ namespace }),
  ]);

  const services = (servicesResult.items ?? [])
    .filter((service) =>
      labelsMatchSelector(
        deployment.spec?.template?.metadata?.labels ?? {},
        service.spec?.selector ?? {},
      ),
    )
    .map((service) => ({
      name: service.metadata?.name,
      type: service.spec?.type,
      clusterIP: service.spec?.clusterIP,
      selector: service.spec?.selector ?? {},
      ports: (service.spec?.ports ?? []).map((port) => ({
        name: port.name,
        port: port.port,
        targetPort: port.targetPort,
        protocol: port.protocol,
      })),
    }));

  const serviceNames = new Set(
    services.map((service) => service.name).filter((value): value is string => Boolean(value)),
  );

  const ingressStandard = (ingressResult.items ?? [])
    .filter((item) =>
      (item.spec?.rules ?? []).some((rule) =>
        (rule.http?.paths ?? []).some((path) => {
          const backendServiceName = path.backend?.service?.name;
          return backendServiceName ? serviceNames.has(backendServiceName) : false;
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
      return {
        name: item.metadata?.name,
        className: item.spec?.ingressClassName ?? null,
        hosts,
      };
    });

  const ingressRouteItems = await listIngressRoutes(namespace);
  const ingressTraefik = ingressRouteItems
    .filter((ir) =>
      ir.routes.some((r) =>
        r.serviceNames.some((sn) => serviceNames.has(sn)),
      ),
    )
    .map((ir) => {
      const hosts = [...new Set(ir.routes.flatMap((r) => r.hosts))];
      if (hosts.length === 0) {
        const paths = ir.routes.map((r) => r.match).filter(Boolean);
        hosts.push(paths.length > 0 ? `* (${paths[0]})` : "*");
      }
      return { name: ir.name, className: ir.className, hosts };
    });

  const ingress = [...ingressStandard, ...ingressTraefik];

  return {
    app,
    namespace,
    selector: deploymentSelector,
    services,
    ingress,
  };
};
