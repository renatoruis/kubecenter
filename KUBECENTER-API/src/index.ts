import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { loadEnv } from "./config/env";
import authPlugin from "./plugins/auth";
import errorHandlerPlugin from "./plugins/error-handler";
import swaggerPlugin from "./plugins/swagger";
import clusterRoutes from "./modules/cluster/routes";
import applicationsRoutes from "./modules/applications/routes";
import podsRoutes from "./modules/pods/routes";
import logsRoutes from "./modules/logs/routes";
import configMapsRoutes from "./modules/configmaps/routes";
import secretsRoutes from "./modules/secrets/routes";
import databasesRoutes from "./modules/databases/routes";
import metricsRoutes from "./modules/metrics/routes";
import networkRoutes from "./modules/network/routes";
import eventsRoutes from "./modules/events/routes";

async function registerModules(app: FastifyInstance): Promise<void> {
  await app.register(clusterRoutes);
  await app.register(applicationsRoutes);
  await app.register(podsRoutes);
  await app.register(logsRoutes);
  await app.register(configMapsRoutes);
  await app.register(secretsRoutes);
  await app.register(databasesRoutes);
  await app.register(metricsRoutes);
  await app.register(networkRoutes);
  await app.register(eventsRoutes);
}

async function bootstrap(): Promise<void> {
  const config = loadEnv();

  const app = Fastify({
    logger: {
      level: config.logLevel
    },
    ajv: {
      customOptions: {
        strict: false,
        keywords: ["example"],
      },
    },
  });

  await app.register(cors, {
    origin: true
  });

  await app.register(swaggerPlugin);

  await app.register(authPlugin, {
    apiToken: config.apiToken
  });

  await app.register(errorHandlerPlugin);

  app.get("/health", async () => {
    return {
      status: "ok"
    };
  });

  app.get("/healthz", async () => {
    return {
      status: "ok"
    };
  });

  await registerModules(app);

  await app.listen({
    port: config.port,
    host: "0.0.0.0"
  });
}

void bootstrap();
