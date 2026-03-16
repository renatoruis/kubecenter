import { appsApi, assertNamespaceAllowed, coreApi, notFoundError } from "../../lib/k8s";
import { extractWorkloadRefs } from "../shared/selectors";

const decodeSecretData = (data: Record<string, string> = {}) =>
  Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      Buffer.from(value, "base64").toString("utf8"),
    ]),
  );

export const getApplicationSecrets = async (namespace: string, app: string) => {
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
  const names = Array.from(refs.secrets);

  const secrets = await Promise.all(
    names.map(async (name) => {
      const secret = await coreApi
        .readNamespacedSecret({ namespace, name })
        .catch((error: { statusCode?: number }) => {
          if (error?.statusCode === 404) return null;
          throw error;
        });

      const keys = Object.keys(secret?.data ?? {});
      const entries = keys.map((key) => ({ key, value: "***" }));
      return {
        name,
        found: Boolean(secret),
        type: secret?.type ?? null,
        usage: refs.secretUsage[name] ?? [],
        keys,
        entries,
      };
    }),
  );

  return {
    app,
    namespace,
    count: secrets.length,
    secrets,
  };
};

export const getSecretValues = async (
  namespace: string,
  secretName: string,
) => {
  assertNamespaceAllowed(namespace);

  const secret = await coreApi
    .readNamespacedSecret({ namespace, name: secretName })
    .catch((error: { statusCode?: number }) => {
      if (error?.statusCode === 404) {
        throw notFoundError("Secret", { namespace, secretName });
      }
      throw error;
    });

  return {
    name: secret.metadata?.name,
    namespace: secret.metadata?.namespace,
    type: secret.type ?? null,
    values: decodeSecretData(secret.data ?? {}),
  };
};

export const getSecretValueForKey = async (
  namespace: string,
  secretName: string,
  key: string,
) => {
  assertNamespaceAllowed(namespace);

  const secret = await coreApi
    .readNamespacedSecret({ namespace, name: secretName })
    .catch((error: { statusCode?: number }) => {
      if (error?.statusCode === 404) {
        throw notFoundError("Secret", { namespace, secretName });
      }
      throw error;
    });

  const data = secret.data ?? {};
  const raw = data[key];
  if (raw === undefined) {
    throw notFoundError("SecretKey", { namespace, secretName, key });
  }

  const value = Buffer.from(raw, "base64").toString("utf8");
  return { key, value };
};
