import { appsApi, assertNamespaceAllowed, coreApi, notFoundError } from "../../lib/k8s";
import { extractWorkloadRefs } from "../shared/selectors";

export const getApplicationConfigMaps = async (namespace: string, app: string) => {
  assertNamespaceAllowed(namespace);

  const deployment = await appsApi
    .readNamespacedDeployment({ namespace, name: app })
    .catch((error: { statusCode?: number }) => {
      if (error?.statusCode === 404) {
        throw notFoundError("Deployment", { namespace, app });
      }
      throw error;
    });

  const refs = extractWorkloadRefs(deployment.spec?.template?.spec);
  const names = Array.from(refs.configMaps);

  const configMaps = await Promise.all(
    names.map(async (name) => {
      const configMap = await coreApi
        .readNamespacedConfigMap({ namespace, name })
        .catch((error: { statusCode?: number }) => {
          if (error?.statusCode === 404) return null;
          throw error;
        });

      return {
        name,
        found: Boolean(configMap),
        usage: refs.configMapUsage[name] ?? [],
        data: configMap?.data ?? {},
        binaryDataKeys: Object.keys(configMap?.binaryData ?? {}),
      };
    }),
  );

  return {
    app,
    namespace,
    count: configMaps.length,
    configMaps,
  };
};
