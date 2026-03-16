import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

const swaggerPlugin: FastifyPluginAsync = async (app) => {
  // Schema compartilhado registrado no Fastify para uso com $ref
  app.addSchema({
    $id: "HttpError",
    type: "object",
    properties: {
      error: { type: "string", example: "RESOURCE_NOT_FOUND" },
      message: { type: "string", example: "Deployment payments-api not found." },
    },
  });

  await app.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "KubeCenter — K8s Observability API",
        description:
          "API de observabilidade Kubernetes: agrega aplicações, pods, logs, métricas, databases e configurações em uma interface unificada.",
        version: "1.0.0",
        contact: {
          name: "KubeCenter",
        },
      },
      tags: [
        { name: "Cluster", description: "Visão geral do cluster" },
        { name: "Applications", description: "Aplicações (Deployments)" },
        { name: "Pods", description: "Pods" },
        { name: "Logs", description: "Logs de containers" },
        { name: "ConfigMaps", description: "ConfigMaps" },
        { name: "Secrets", description: "Secrets" },
        { name: "Databases", description: "Discovery e metadata de bancos de dados" },
        { name: "Metrics", description: "Métricas de CPU e memória" },
        { name: "Network", description: "Services e Ingress" },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
      persistAuthorization: true,
    },
    staticCSP: true,
  });
};

export default fp(swaggerPlugin, { name: "swagger" });
